import crypto from 'crypto';

import {
  createClient,
} from '@supabase/supabase-js';
import { sendEmail, bookingUrl, esc, date, money } from '../../../lib/serverEmail';

const SUPABASE_URL =
  'https://gxwemplbykjxhezefykh.supabase.co';

function getSupabaseAdmin() {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured.'
    );
  }

  return createClient(
    SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export async function POST(request) {
  try {
    const supabase =
      getSupabaseAdmin();

    const razorpayKeyId =
      process.env.RAZORPAY_KEY_ID;

    const razorpayKeySecret =
      process.env.RAZORPAY_KEY_SECRET;

    if (
      !razorpayKeyId ||
      !razorpayKeySecret
    ) {
      throw new Error(
        'Razorpay environment variables are not configured.'
      );
    }

    const {
      bookingCode,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } =
      await request.json();

    const cleanBookingCode =
      String(
        bookingCode || ''
      ).trim();

    if (
      !cleanBookingCode ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return Response.json(
        {
          error:
            'Missing payment verification data.',
        },
        {
          status: 400,
        }
      );
    }

    /*
      =================================
      VERIFY RAZORPAY SIGNATURE
      =================================
    */

    const generatedSignature =
      crypto
        .createHmac(
          'sha256',
          razorpayKeySecret
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest(
          'hex'
        );

    const generatedBuffer =
      Buffer.from(
        generatedSignature,
        'utf8'
      );

    const receivedBuffer =
      Buffer.from(
        String(
          razorpay_signature
        ),
        'utf8'
      );

    if (
      generatedBuffer.length !==
      receivedBuffer.length
    ) {
      return Response.json(
        {
          error:
            'Payment signature verification failed.',
        },
        {
          status: 400,
        }
      );
    }

    const signatureMatches =
      crypto.timingSafeEqual(
        generatedBuffer,
        receivedBuffer
      );

    if (
      !signatureMatches
    ) {
      return Response.json(
        {
          error:
            'Payment signature verification failed.',
        },
        {
          status: 400,
        }
      );
    }

    /*
      =================================
      FETCH CURRENT BOOKING
      =================================
    */

    const {
      data:
        booking,
      error:
        bookingError,
    } =
      await supabase
        .from('bookings')
        .select(`
          id,
          booking_code,
          property_id,
          guest_id,
          check_in,
          check_out,
          total_amount,
          amount_including_gst,
          final_payable_amount,
          taxable_amount,
          gst_amount,
          security_deposit,
          offer_status,
          razorpay_order_id,
          payment_status,
          booking_status,
          host_decision,
          host_decision_at,
          payment_due_at,
          verification_status
        `)
        .eq(
          'booking_code',
          cleanBookingCode
        )
        .single();

    if (
      bookingError ||
      !booking
    ) {
      console.error(
        'Booking fetch error:',
        bookingError
      );

      return Response.json(
        {
          error:
            'Booking not found.',
        },
        {
          status: 404,
        }
      );
    }

    /*
      Already recorded as paid.
      Verification endpoint remains
      idempotent.
    */

    if (
      booking.payment_status ===
      'paid'
    ) {
      return Response.json({
        success:
          true,

        bookingCode:
          booking.booking_code,

        paymentId:
          razorpay_payment_id,

        status:
          'paid',

        bookingStatus:
          booking.booking_status,

        alreadyPaid:
          true,

        datesBlocked:
          true,
      });
    }

    /*
      Host approval is compulsory.
    */

    if (
      booking.host_decision !==
      'approved' &&
      booking.offer_status !==
      'accepted'
    ) {
      return Response.json(
        {
          error:
            'Host approval is required before payment can be confirmed.',
        },
        {
          status: 400,
        }
      );
    }

    /*
      Closed booking cannot normally
      be confirmed.

      We still fetch Razorpay payment
      later only for valid active
      bookings.
    */

    if (
      booking.booking_status ===
        'declined' ||
      booking.booking_status ===
        'completed'
    ) {
      return Response.json(
        {
          error:
            'This booking is no longer active.',
        },
        {
          status: 400,
        }
      );
    }

    /*
      =================================
      VERIFY ORDER BELONGS TO BOOKING
      =================================
    */

    if (
      booking.razorpay_order_id !==
      razorpay_order_id
    ) {
      return Response.json(
        {
          error:
            'Order ID does not match this booking.',
        },
        {
          status: 400,
        }
      );
    }

    /*
      =================================
      DETERMINE EXPECTED AMOUNT
      =================================

      Accepted host offer:
      final_payable_amount

      Normal booking:
      amount_including_gst

      Never trust amount from browser.
    */

    let expectedPayableAmount =
      0;

    let paymentType =
      'normal';

    if (
      booking.offer_status ===
        'accepted' &&
      Number(
        booking.final_payable_amount
      ) > 0
    ) {
      expectedPayableAmount =
        Number(
          booking.final_payable_amount
        );

      paymentType =
        'special_offer';
    } else {
      expectedPayableAmount =
        Number(
          booking.amount_including_gst ||
          booking.total_amount ||
          0
        );

      paymentType =
        'normal';
    }

    if (
      !Number.isFinite(
        expectedPayableAmount
      ) ||
      expectedPayableAmount <= 0
    ) {
      return Response.json(
        {
          error:
            'Invalid expected booking payment amount.',
        },
        {
          status: 400,
        }
      );
    }

    const expectedAmountInPaise =
      Math.round(
        expectedPayableAmount *
          100
      );

    /*
      =================================
      FETCH PAYMENT FROM RAZORPAY
      =================================
    */

    const auth =
      Buffer.from(
        `${razorpayKeyId}:${razorpayKeySecret}`
      ).toString(
        'base64'
      );

    const paymentResponse =
      await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(
          razorpay_payment_id
        )}`,
        {
          headers: {
            Authorization:
              `Basic ${auth}`,
          },

          cache:
            'no-store',
        }
      );

    const payment =
      await paymentResponse.json();

    if (
      !paymentResponse.ok
    ) {
      console.error(
        'Razorpay payment fetch error:',
        payment
      );

      return Response.json(
        {
          error:
            payment?.error
              ?.description ||
            'Unable to verify payment with Razorpay.',
        },
        {
          status: 500,
        }
      );
    }

    /*
      =================================
      FINAL RAZORPAY VALIDATION
      =================================
    */

    if (
      payment.order_id !==
      razorpay_order_id
    ) {
      return Response.json(
        {
          error:
            'Razorpay order does not match.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      Number(
        payment.amount
      ) !==
      expectedAmountInPaise
    ) {
      return Response.json(
        {
          error:
            'Paid amount does not match the booking amount.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      payment.currency !==
      'INR'
    ) {
      return Response.json(
        {
          error:
            'Invalid payment currency.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      payment.status !==
      'captured'
    ) {
      return Response.json(
        {
          error:
            'Payment has not been successfully captured.',
        },
        {
          status: 400,
        }
      );
    }

    /*
      =================================
      PAYMENT DEADLINE SAFETY
      =================================

      This is important even though
      create-order already checks the
      deadline.

      A guest could keep an old
      Razorpay checkout window open
      and complete payment after the
      24-hour deadline.

      If Razorpay has captured money
      after expiry, DO NOT confirm the
      stay automatically.
    */

    if (
      booking.payment_due_at
    ) {
      const paymentDueTime =
        new Date(
          booking.payment_due_at
        ).getTime();

      const capturedAt =
        payment.created_at
          ? Number(
              payment.created_at
            ) * 1000
          : Date.now();

      if (
        Number.isFinite(
          paymentDueTime
        ) &&
        capturedAt >
          paymentDueTime
      ) {
        const now =
          new Date().toISOString();

        await supabase
          .from('bookings')
          .update({
            booking_status:
              'cancelled',

            updated_at:
              now,
          })
          .eq(
            'id',
            booking.id
          )
          .eq(
            'payment_status',
            'unpaid'
          );

        const {
          error:
            expiredMessageError,
        } =
          await supabase
            .from(
              'booking_messages'
            )
            .insert({
              booking_id:
                booking.id,

              sender_type:
                'system',

              sender_name:
                'NightOutStays',

              message:
                'Payment was received after the 24-hour host approval period had expired. The booking was not confirmed automatically. Please contact support for payment resolution.',

              message_type:
                'system',

              is_read:
                false,
            });

        if (
          expiredMessageError
        ) {
          console.warn(
            'Expired payment message failed:',
            expiredMessageError
          );
        }

        return Response.json(
          {
            success:
              false,

            expired:
              true,

            paymentCaptured:
              true,

            requiresManualRefund:
              true,

            error:
              'Payment was captured after the booking approval expired. The booking has not been confirmed. Please contact support.',
          },
          {
            status: 409,
          }
        );
      }
    }

    /*
      =================================
      DOUBLE BOOKING SAFETY
      =================================

      Any already-paid overlapping
      NightOutStays booking occupies
      inventory.

      We intentionally check
      payment_status = paid rather
      than relying only on booking
      status.
    */

    const {
      data:
        conflictingBookings,
      error:
        conflictError,
    } =
      await supabase
        .from('bookings')
        .select(`
          id,
          booking_code,
          check_in,
          check_out
        `)
        .eq(
          'property_id',
          booking.property_id
        )
        .eq(
          'payment_status',
          'paid'
        )
        .neq(
          'id',
          booking.id
        )
        .lt(
          'check_in',
          booking.check_out
        )
        .gt(
          'check_out',
          booking.check_in
        );

    if (
      conflictError
    ) {
      console.error(
        'Conflict check failed:',
        conflictError
      );

      return Response.json(
        {
          error:
            'Unable to verify booking availability after payment.',

          paymentCaptured:
            true,
        },
        {
          status: 500,
        }
      );
    }

    if (
      conflictingBookings &&
      conflictingBookings.length >
        0
    ) {
      console.error(
        'Paid booking conflict detected:',
        {
          booking:
            booking.booking_code,

          conflicts:
            conflictingBookings,
        }
      );

      const {
        error:
          conflictMessageError,
      } =
        await supabase
          .from(
            'booking_messages'
          )
          .insert({
            booking_id:
              booking.id,

            sender_type:
              'system',

            sender_name:
              'NightOutStays',

            message:
              'Payment was received, but another paid booking already occupies these dates. The booking was not confirmed automatically. Please contact support.',

            message_type:
              'system',

            is_read:
              false,
          });

      if (
        conflictMessageError
      ) {
        console.warn(
          'Conflict message failed:',
          conflictMessageError
        );
      }

      return Response.json(
        {
          error:
            'Payment succeeded, but these dates were already booked by another paid reservation. Please contact support.',

          paymentCaptured:
            true,

          requiresManualRefund:
            true,
        },
        {
          status: 409,
        }
      );
    }

    /*
      =================================
      PAYMENT SUCCESS
      =================================

      Successful payment immediately
      occupies inventory.

      ID verification can happen after
      payment without reopening dates.
    */

    const paidAt =
      new Date().toISOString();

    const {
      data:
        updatedBooking,
      error:
        updateError,
    } =
      await supabase
        .from('bookings')
        .update({
          payment_status:
            'paid',

          booking_status:
            'confirmed',

          razorpay_payment_id,

          razorpay_signature,

          paid_at:
            paidAt,

          verification_status:
            'pending',

          updated_at:
            paidAt,
        })
        .eq(
          'id',
          booking.id
        )
        .eq(
          'payment_status',
          'unpaid'
        )
        .select(`
          id,
          booking_code,
          property_id,
          check_in,
          check_out,
          payment_status,
          booking_status,
          verification_status,
          offer_status,
          final_payable_amount,
          amount_including_gst
        `)
        .single();

    if (
      updateError ||
      !updatedBooking
    ) {
      console.error(
        'Booking update error:',
        updateError
      );

      return Response.json(
        {
          error:
            'Payment succeeded but booking update failed.',

          paymentCaptured:
            true,
        },
        {
          status: 500,
        }
      );
    }

    /*
      =================================
      CREATE HOST SETTLEMENT
      =================================

      Successful payment creates one
      permanent Host settlement row.

      The settlement starts on hold.
      Actual Razorpay/payment/Route
      charges will be recorded as Host
      deductions before payout.
    */

    let settlementCreated =
      false;

    try {
      const {
        data: propertyForSettlement,
        error: propertySettlementError,
      } =
        await supabase
          .from('properties')
          .select('id, host_id')
          .eq(
            'id',
            booking.property_id
          )
          .single();

      if (
        propertySettlementError ||
        !propertyForSettlement?.host_id
      ) {
        throw new Error(
          'Unable to identify Host for settlement.'
        );
      }

      const guestPaidAmount =
        Number(
          payment.amount || 0
        ) / 100;

      const gstCollected =
        Number(
          booking.gst_amount || 0
        );

      const bookingValueBeforeGst =
        Number(
          booking.taxable_amount || 0
        ) > 0
          ? Number(
              booking.taxable_amount
            )
          : Math.max(
              guestPaidAmount -
                gstCollected,
              0
            );

      const securityDeposit =
        Number(
          booking.security_deposit || 0
        );

      /*
        Razorpay payment entity:
        - fee includes GST
        - tax is the GST portion

        Store them separately so GST is
        never deducted twice.
      */

      const razorpayFeeIncludingGst =
        Number.isFinite(
          Number(payment.fee)
        )
          ? Number(payment.fee) / 100
          : 0;

      const razorpayFeeGst =
        Number.isFinite(
          Number(payment.tax)
        )
          ? Number(payment.tax) / 100
          : 0;

      const razorpayFeeBeforeGst =
        Math.max(
          razorpayFeeIncludingGst -
            razorpayFeeGst,
          0
        );

      /*
        GST is not treated as Host
        earnings.

        Security deposit is tracked
        separately and excluded from
        Host gross payout here.
      */

      const hostGrossAmount =
        Math.max(
          bookingValueBeforeGst -
            securityDeposit,
          0
        );

      const {
        data: existingSettlement,
        error: existingSettlementError,
      } =
        await supabase
          .from('host_settlements')
          .select('id')
          .eq(
            'booking_id',
            booking.id
          )
          .maybeSingle();

      if (
        existingSettlementError
      ) {
        throw existingSettlementError;
      }

      if (
        existingSettlement?.id
      ) {
        settlementCreated =
          true;
      } else {
        const {
          data: newSettlement,
          error: settlementError,
        } =
          await supabase
            .from('host_settlements')
            .insert({
              booking_id:
                booking.id,

              property_id:
                booking.property_id,

              host_id:
                propertyForSettlement.host_id,

              guest_paid_amount:
                guestPaidAmount,

              booking_value_before_gst:
                bookingValueBeforeGst,

              gst_collected:
                gstCollected,

              security_deposit:
                securityDeposit,

              host_gross_amount:
                hostGrossAmount,

              guest_payment_gateway_fee:
                razorpayFeeBeforeGst,

              guest_payment_gateway_fee_gst:
                razorpayFeeGst,

              razorpay_payment_id:
                razorpay_payment_id,

              payout_status:
                'pending_calculation',

              is_on_hold:
                true,

              hold_reason:
                'Awaiting payout eligibility and final charge calculation.',
            })
            .select('id')
            .single();

        if (
          settlementError ||
          !newSettlement
        ) {
          throw (
            settlementError ||
            new Error(
              'Settlement creation failed.'
            )
          );
        }

        /*
          Calculate deductions and net
          Host payout immediately.

          Because is_on_hold is true, the
          database function leaves this
          settlement in on_hold status.
        */

        const {
          error:
            calculationError,
        } =
          await supabase.rpc(
            'calculate_host_settlement',
            {
              p_settlement_id:
                newSettlement.id,
            }
          );

        if (
          calculationError
        ) {
          throw calculationError;
        }

        settlementCreated =
          true;
      }
    } catch (
      settlementError
    ) {
      /*
        Payment and booking confirmation
        have already succeeded.

        An internal settlement-ledger
        problem must never turn a valid
        guest payment into a failed
        payment response.
      */

      console.error(
        'Payment succeeded but Host settlement creation failed:',
        settlementError
      );
    }

    /*
      =================================
      PAYMENT SYSTEM MESSAGE
      =================================
    */

    const paymentMessage =
      paymentType ===
      'special_offer'
        ? `Payment received for the accepted special offer for booking ${booking.booking_code}. Booking is confirmed and contact details are now available to both Guest and Host.`
        : `Payment received for booking ${booking.booking_code}. Booking is confirmed and contact details are now available to both Guest and Host.`;

    const {
      error:
        messageError,
    } =
      await supabase
        .from(
          'booking_messages'
        )
        .insert({
          booking_id:
            booking.id,

          sender_type:
            'system',

          sender_name:
            'NightOutStays',

          message:
            paymentMessage,

          message_type:
            'payment',

          is_read:
            false,
        });

    if (
      messageError
    ) {
      console.warn(
        'Payment succeeded but message could not be created:',
        messageError
      );
    }

    /* CONTACT UNLOCK + CONFIRMATION EMAILS */
    try {
      const [{ data: guestContact }, { data: propertyContact }] = await Promise.all([
        supabase.from('guests').select('id,user_id,full_name,email,phone').eq('id', booking.guest_id).maybeSingle(),
        supabase.from('properties').select('id,name,location_name,area,city,host_id').eq('id', booking.property_id).maybeSingle(),
      ]);
      const { data: hostContact } = propertyContact?.host_id
        ? await supabase.from('host_profiles').select('id,user_id,full_name,business_name,email,phone').eq('id', propertyContact.host_id).maybeSingle()
        : { data: null };
      const contactMessage = `Booking confirmed. Contact details are now available to both Guest and Host.${hostContact?.phone ? ` Host: ${hostContact.business_name || hostContact.full_name || 'Host'} - ${hostContact.phone}.` : ''}${guestContact?.phone ? ` Guest: ${guestContact.full_name || 'Guest'} - ${guestContact.phone}.` : ''}`;
      await supabase.from('booking_messages').insert({ booking_id: booking.id, sender_type: 'system', sender_name: 'NightOutStays', message: contactMessage, message_type: 'confirmation', is_read: false });
      const common = `<p style="font-size:14px;line-height:1.65;color:#5d6670">Payment is successful for <b>${esc(propertyContact?.name || 'your stay')}</b>.</p><table style="width:100%;border-collapse:collapse;font-size:13px"><tr><td style="padding:7px 0;color:#77808a">Booking</td><td style="text-align:right;font-weight:700">${esc(booking.booking_code)}</td></tr><tr><td style="padding:7px 0;color:#77808a">Stay</td><td style="text-align:right;font-weight:700">${date(booking.check_in)} → ${date(booking.check_out)}</td></tr><tr><td style="padding:7px 0;color:#77808a">Amount paid</td><td style="text-align:right;font-weight:700">${money(expectedPayableAmount)}</td></tr></table>`;
      if (guestContact?.user_id) await supabase.from('notifications').insert({ recipient_type:'guest',recipient_user_id:guestContact.user_id,recipient_guest_id:guestContact.id,booking_id:booking.id,property_id:booking.property_id,type:'booking_confirmed',title:'Payment successful - booking confirmed',body:`Your booking ${booking.booking_code} is confirmed. Host contact details are now unlocked.`,priority:'important',action_url:'/account/bookings',email_status:'pending' });
      if (hostContact?.user_id) await supabase.from('notifications').insert({ recipient_type:'host',recipient_user_id:hostContact.user_id,host_id:hostContact.id,booking_id:booking.id,property_id:booking.property_id,type:'payment_received',title:'Guest payment received',body:`Booking ${booking.booking_code} is confirmed. Guest contact details are now unlocked.`,priority:'important',action_url:'/host/bookings',email_status:'pending' });
      if (guestContact?.email) await sendEmail({ to:guestContact.email,subject:`Booking confirmed - ${propertyContact?.name || booking.booking_code}`,title:'Your booking is confirmed',preheader:'Payment successful. Host contact is unlocked.',bodyHtml:`${common}<div style="margin-top:16px;background:#fff4f9;border:1px solid #ffd0e7;border-radius:12px;padding:13px"><b>Host contact</b><br/>${esc(hostContact?.business_name || hostContact?.full_name || 'Host')}<br/>${esc(hostContact?.phone || 'Contact number unavailable')}</div>`,ctaLabel:'Open My Booking',ctaUrl:bookingUrl('/account/bookings') });
      if (hostContact?.email) await sendEmail({ to:hostContact.email,subject:`Payment received - ${booking.booking_code}`,title:'Guest payment received',preheader:'Booking is confirmed. Guest contact is unlocked.',bodyHtml:`${common}<div style="margin-top:16px;background:#fff4f9;border:1px solid #ffd0e7;border-radius:12px;padding:13px"><b>Guest contact</b><br/>${esc(guestContact?.full_name || 'Guest')}<br/>${esc(guestContact?.phone || 'Contact number unavailable')}</div>`,ctaLabel:'Open Host Booking',ctaUrl:bookingUrl('/host/bookings') });
    } catch (contactError) {
      console.warn('Payment confirmed but contact/email workflow failed:', contactError);
    }

    /*
      =================================
      CLOSE OTHER UNPAID REQUESTS
      =================================

      Once this guest/payment wins
      these dates, overlapping unpaid
      requests should no longer be
      payable.
    */

    const {
      data:
        losingBookings,
      error:
        losingBookingsError,
    } =
      await supabase
        .from('bookings')
        .select(
          'id, booking_code'
        )
        .eq(
          'property_id',
          booking.property_id
        )
        .eq(
          'payment_status',
          'unpaid'
        )
        .neq(
          'id',
          booking.id
        )
        .lt(
          'check_in',
          booking.check_out
        )
        .gt(
          'check_out',
          booking.check_in
        );

    if (
      losingBookingsError
    ) {
      console.warn(
        'Unable to find overlapping unpaid requests:',
        losingBookingsError
      );
    } else if (
      losingBookings?.length
    ) {
      for (
        const losingBooking
        of losingBookings
      ) {
        const {
          error:
            closeError,
        } =
          await supabase
            .from('bookings')
            .update({
              booking_status:
                'cancelled',

              updated_at:
                paidAt,
            })
            .eq(
              'id',
              losingBooking.id
            )
            .eq(
              'payment_status',
              'unpaid'
            );

        if (closeError) {
          console.warn(
            'Unable to close overlapping request:',
            closeError
          );

          continue;
        }

        const {
          error:
            closeMessageError,
        } =
          await supabase
            .from(
              'booking_messages'
            )
            .insert({
              booking_id:
                losingBooking.id,

              sender_type:
                'system',

              sender_name:
                'NightOutStays',

              message:
                'These dates are no longer available because another guest completed payment first. Please submit a new request for different available dates.',

              message_type:
                'system',

              is_read:
                false,
            });

        if (
          closeMessageError
        ) {
          console.warn(
            'Unable to add overlapping request message:',
            closeMessageError
          );
        }
      }
    }

    /*
      =================================
      RESPONSE
      =================================
    */

    return Response.json({
      success:
        true,

      bookingCode:
        updatedBooking.booking_code,

      paymentId:
        razorpay_payment_id,

      status:
        'paid',

      bookingStatus:
        updatedBooking.booking_status,

      verificationStatus:
        updatedBooking.verification_status,

      paymentType,

      amountPaid:
        expectedPayableAmount,

      datesBlocked:
        true,

      identityVerificationRequired:
        false,

      settlementCreated,
    });
  } catch (error) {
    console.error(
      'Razorpay verify error:',
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          'Server error while verifying payment.',
      },
      {
        status: 500,
      }
    );
  }
}