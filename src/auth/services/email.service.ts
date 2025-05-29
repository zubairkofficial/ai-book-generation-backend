import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class EmailService {
  private transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT') || 587,
      secure: false, // Use SSL
      auth: {
        user: this.configService.get<string>('MAIL_USERNAME'),
        pass: this.configService.get<string>('MAIL_PASSWORD'),
      },
    });
  }
  async sendOtpEmail(email: string, otp: string) {
    const subject = 'Your OTP Code';
    const text = `Your OTP code is: ${otp}`;
    const html = `
      <p>Dear user,</p>
      <p>Your OTP code is: <strong>${otp}</strong></p>
      <p>This code will expire in 5 minutes.</p>
    `;

    await this.sendEmail(email, subject, text, html);
  }

  
  async sendVerificationEmail(user: User, verifyLink: string) {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Email Verification</title>
          <style>
            /* General Resets */
            body, table, td, a {
              -webkit-text-size-adjust: 100%;
              -ms-text-size-adjust: 100%;
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            table, td {
              mso-table-lspace: 0pt;
              mso-table-rspace: 0pt;
              border-collapse: collapse;
            }
            img {
              -ms-interpolation-mode: bicubic;
              border: 0;
            }
            /* Responsive Styles */
            @media screen and (max-width: 600px) {
              .container {
                width: 100% !important;
                padding: 20px !important;
              }
              .button {
                width: 100% !important;
                min-width: 120px !important;
                padding: 15px 10px !important;
                font-size: 16px !important;
              }
              .header {
                font-size: 24px !important;
              }
              .content {
                font-size: 16px !important;
                line-height: 1.5 !important;
              }
            }
            /* Dark Mode Support */
            @media (prefers-color-scheme: dark) {
              .body {
                background-color: #1a1a1a !important;
              }
              .container {
                background-color: #2d2d2d !important;
              }
              .content {
                color: #ffffff !important;
              }
              .header {
                color: #ffffff !important;
              }
            }
          </style>
        </head>
        <body class="body" style="margin: 0; padding: 0; background-color: #f8f8f8;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <tr>
                    <td align="center" style="padding: 40px 20px;">
                      <h1 class="header" style="color: #031a2e; margin: 0; font-size: 28px; font-weight: bold;">Welcome to AI Book Legacy, <br/><strong style="color: #f59e0b;">${user.name}</strong>!</h1>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 0 40px;">
                      <p class="content" style="color: #4b5563; font-size: 18px; line-height: 1.6; margin: 0 0 30px 0;">
                        Thank you for signing up! Please verify your email address to get started.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 20px 40px 40px 40px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center">
                            <a href="${verifyLink}" class="button" style="
                              background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                              color: #ffffff !important;
                              text-decoration: none;
                              border-radius: 8px;
                              font-weight: bold;
                              padding: 16px 32px;
                              font-size: 18px;
                              display: inline-block;
                              min-width: 200px;
                              text-align: center;
                              box-shadow: 0 4px 6px rgba(245, 158, 11, 0.25);
                              transition: all 0.3s ease;
                              border: 2px solid #f59e0b;
                            ">
                              Verify Your Email
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 0 40px 40px 40px;">
                      <p style="color: #6b7280; font-size: 14px; margin: 0;">
                        This verification link will expire in 1 hour for security reasons.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f9fafb; border-radius: 0 0 12px 12px; padding: 20px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center" style="color: #6b7280; font-size: 14px;">
                            If you didn't create an account, you can safely ignore this email.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    await this.sendEmail(
      user.email,
      'Verify Your Email - AI Book Legacy',
      `Hello ${user.name},\n\nPlease verify your email by clicking this link: ${verifyLink}\n\nThis link will expire in 1 hour.`,
      html,
    );
  }

  async sendPasswordResetEmail(user: User, resetLink: string) {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Password Reset Request</title>
          <style>
            /* General Resets */
            body, table, td, a {
              -webkit-text-size-adjust: 100%;
              -ms-text-size-adjust: 100%;
            }
            table, td {
              mso-table-lspace: 0pt;
              mso-table-rspace: 0pt;
            }
            img {
              -ms-interpolation-mode: bicubic;
            }
            /* Responsive Styles */
            @media screen and (max-width: 600px) {
              .container {
                width: 100% !important;
                padding: 10px !important;
              }
              .button {
                width: 100% !important;
                padding: 15px !important;
                display: block !important;
              }
            }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f8f8;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" bgcolor="#f8f8f8" style="padding: 20px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                  <tr>
                    <td align="center" style="padding: 20px;">
                      <h1 style="color: #031a2e; font-family: Arial, sans-serif; margin: 0;">Password Reset Request</h1>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 0 20px 20px 20px;">
                      <p style="color: #666666; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">
                        Hi <strong>${user.name}</strong>,
                      </p>
                      <p style="color: #666666; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">
                        We received a request to reset your password. You can reset your password by clicking the button below:
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 20px;">
                      <a href="${resetLink}" class="button" style="background: linear-gradient(180deg, #fbbf24, #f59e0b); color: #ffffff !important; text-decoration: none; border-radius: 4px; font-weight: bold; padding: 15px 20px; display: inline-block;">
                        Reset Your Password
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 0 20px 20px 20px;">
                      <p style="color: #666666; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">
                        This link will expire in 1 hour.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    await this.sendEmail(
      user.email,
      'Reset Your Password',
      `Hello ${user.name},\n\nPlease reset your password by clicking this link: ${resetLink}\n\nThis link will expire in 1 hour.`,
      html,
    );
  }

  private async sendEmail(
    to: string,
    subject: string,
    text: string,
    html: string,
  ) {
    try {
      const info = await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM_ADDRESS'), // Sender address
        to,
        subject,
        text,
        html,
      });
      console.log('Message sent:', info.messageId);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Error sending email'); // Rethrow the error for the caller to handle
    }
  }

  async sendInsufficientFundsEmail(userEmail: string) {
    const subject = 'Insufficient Balance for Auto-Renewal';
    const text = `Your subscription could not be renewed due to insufficient balance. Please recharge your wallet.`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8f8f8;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          <h2 style="color: #031a2e;">Subscription Renewal Failed</h2>
          <p>Dear user,</p>
          <p>Your subscription could not be renewed because of insufficient balance in your wallet.</p>
          <p>Please <strong>recharge your wallet</strong> to continue enjoying our services.</p>
          <p>If you need help, contact us at <a href="mailto:aibook@gmail.com">aibook@gmail.com</a>.</p>
          <p>Thank you,<br/>The ai book Team</p>
        </div>
      </div>
    `;
  
    await this.sendEmail(userEmail, subject, text, html);
  }
  
  
}
