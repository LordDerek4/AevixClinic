/**
 * MVP message "sender". Logs to the console so the reminder job's logic and
 * timing can be exercised and tested without a real SMS/WhatsApp account.
 *
 * ---------------------------------------------------------------------------
 * PLUG IN A REAL PROVIDER HERE once you have an account + API key.
 *
 * Twilio:
 *   npm install twilio
 *   import twilio from 'twilio';
 *   const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
 *   await client.messages.create({ to, from: process.env.TWILIO_FROM_NUMBER, body: message });
 *
 * Africa's Talking:
 *   npm install africastalking
 *   import AfricasTalking from 'africastalking';
 *   const at = AfricasTalking({ apiKey: process.env.AT_API_KEY, username: process.env.AT_USERNAME });
 *   await at.SMS.send({ to: [to], message, from: process.env.AT_SHORTCODE });
 * ---------------------------------------------------------------------------
 */
export async function sendSms(to: string, message: string): Promise<void> {
  console.log(`\n[SMS -> ${to}]\n${message}\n`);
}
