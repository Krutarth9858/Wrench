"""Wrench transactional email content.

Plain, brand-consistent and deliberately minimal: a verification email carries
the code, when it expires, and nothing else. No account details, no links that
could be phished, no personal data beyond what the recipient already knows.
"""

from typing import Tuple

BRAND = "#3ECF8E"
INK = "#0A0A0B"


def verification_email(code: str, expiry_minutes: int) -> Tuple[str, str, str]:
    """Return (subject, html, text) for an email verification code."""
    subject = "Your Wrench verification code"

    text = (
        "Hi,\n\n"
        "Your Wrench verification code is:\n\n"
        f"{code}\n\n"
        f"This code expires in {expiry_minutes} minutes.\n\n"
        "If you didn't request this code, you can safely ignore this email.\n\n"
        "— Wrench"
    )

    html = f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#F5F7F6;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:16px;
                  border:1px solid #E6EAE8;overflow:hidden;">
      <tr>
        <td style="padding:28px 32px 0;">
          <span style="display:inline-block;width:28px;height:28px;border-radius:8px;
                       background:{INK};color:{BRAND};text-align:center;line-height:28px;
                       font-weight:700;font-size:14px;">W</span>
          <span style="margin-left:10px;font-size:12px;font-weight:700;letter-spacing:.2em;
                       color:{INK};vertical-align:middle;">WRENCH</span>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 8px;">
          <p style="margin:0 0 16px;font-size:15px;color:#3F4A45;">Hi,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#3F4A45;">
            Your Wrench verification code is:
          </p>
          <p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:.28em;
                    color:{INK};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">
            {code}
          </p>
          <p style="margin:0 0 20px;font-size:14px;color:#6B7770;">
            This code expires in {expiry_minutes} minutes.
          </p>
          <p style="margin:0 0 28px;font-size:13px;color:#8A948F;">
            If you didn't request this code, you can safely ignore this email.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>"""
    return subject, html, text
