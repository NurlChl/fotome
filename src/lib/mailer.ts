import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465' || process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationEmail(to: string, token: string) {
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from: `"FotoMe" <${process.env.SMTP_FROM || 'noreply@fotome.app'}>`,
    to,
    subject: 'Verifikasi Akun FotoMe Anda',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #f43f5e;">Selamat datang di FotoMe!</h2>
        <p>Terima kasih telah mendaftar. Silakan klik tombol di bawah ini untuk memverifikasi alamat email Anda dan mengaktifkan akun Anda:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background-color: #f43f5e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verifikasi Email</a>
        </div>
        <p>Atau salin tautan berikut ke browser Anda:</p>
        <p><a href="${verifyUrl}" style="color: #fb7185;">${verifyUrl}</a></p>
        <hr style="border: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #71717a; font-size: 12px;">Jika Anda tidak merasa mendaftar di FotoMe, abaikan email ini.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent: %s', info.messageId);
    if (process.env.SMTP_HOST === 'smtp.ethereal.email') {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

  const mailOptions = {
    from: `"FotoMe" <${process.env.SMTP_FROM || 'noreply@fotome.app'}>`,
    to,
    subject: 'Reset Password Akun FotoMe Anda',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #f43f5e;">Permintaan Reset Password</h2>
        <p>Kami menerima permintaan untuk mereset password akun FotoMe Anda. Silakan klik tombol di bawah ini untuk membuat password baru:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #f43f5e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p>Atau salin tautan berikut ke browser Anda:</p>
        <p><a href="${resetUrl}" style="color: #fb7185;">${resetUrl}</a></p>
        <p>Tautan ini akan kedaluwarsa dalam 1 jam.</p>
        <hr style="border: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #71717a; font-size: 12px;">Jika Anda tidak merasa meminta reset password, abaikan email ini. Password Anda akan tetap aman.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent: %s', info.messageId);
    if (process.env.SMTP_HOST === 'smtp.ethereal.email') {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}
