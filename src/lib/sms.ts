let twilioClient: any = null;
let sdkAvailable = false;

async function loadTwilio() {
  if (sdkAvailable) return true;
  try {
    // Dynamic import to avoid build-time resolution
    const twilio = await new Function('m', 'return import(m)')('twilio').then((m: any) => m.default || m);
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) return false;
    twilioClient = twilio(accountSid, authToken);
    sdkAvailable = true;
    return true;
  } catch {
    return false;
  }
}

export function isSmsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

export async function sendSmsOtp(phoneNumber: string, code: string): Promise<boolean> {
  if (!(await loadTwilio())) return false;
  try {
    await twilioClient.messages.create({
      body: `Your verification code is: ${code}. It expires in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
    return true;
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
}
