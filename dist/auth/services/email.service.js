"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer = require("nodemailer");
let EmailService = class EmailService {
    constructor(configService) {
        this.configService = configService;
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('MAIL_HOST'),
            port: this.configService.get('MAIL_PORT') || 587,
            secure: false,
            auth: {
                user: this.configService.get('MAIL_USERNAME'),
                pass: this.configService.get('MAIL_PASSWORD'),
            },
        });
    }
    async sendOtpEmail(email, otp) {
        const subject = 'Your OTP Code';
        const text = `Your OTP code is: ${otp}`;
        const html = `
      <p>Dear user,</p>
      <p>Your OTP code is: <strong>${otp}</strong></p>
      <p>This code will expire in 5 minutes.</p>
    `;
        await this.sendEmail(email, subject, text, html);
    }
    async sendVerificationEmail(user, verifyLink) {
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
                      <h1 style="color: #031a2e; font-family: Arial, sans-serif; margin: 0;">Welcome to MyApp, <strong>${user.name}</strong>!</h1>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 0 20px 20px 20px;">
                      <p style="color: #666666; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5;">
                        Thank you for signing up. Please verify your email address by clicking the button below.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 20px;">
                      <a href="${verifyLink}" class="button" style="background: linear-gradient(180deg, #fbbf24, #f59e0b); color: #ffffff !important; text-decoration: none; border-radius: 4px; font-weight: bold; padding: 15px 20px; display: inline-block;">
                        Verify Your Email
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
        await this.sendEmail(user.email, 'Verify Your Email', `Hello ${user.name},\n\nPlease verify your email by clicking this link: ${verifyLink}\n\nThis link will expire in 1 hour.`, html);
    }
    async sendPasswordResetEmail(user, resetLink) {
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
        await this.sendEmail(user.email, 'Reset Your Password', `Hello ${user.name},\n\nPlease reset your password by clicking this link: ${resetLink}\n\nThis link will expire in 1 hour.`, html);
    }
    async sendEmail(to, subject, text, html) {
        try {
            const info = await this.transporter.sendMail({
                from: this.configService.get('MAIL_FROM_ADDRESS'),
                to,
                subject,
                text,
                html,
            });
            console.log('Message sent:', info.messageId);
        }
        catch (error) {
            console.error('Error sending email:', error);
            throw new Error('Error sending email');
        }
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EmailService);
//# sourceMappingURL=email.service.js.map