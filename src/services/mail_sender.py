import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr
import logging

logger = logging.getLogger(__name__)

# 发件邮箱配置
SENDER_EMAIL = "3146502259@proton.me"
SENDER_PASSWORD = "2450Liufang%"
SMTP_SERVER = "smtp.proton.me"
SMTP_PORT = 587

def send_mail(receiver_email, subject, content):
    """发送邮件通知
    Args:
        receiver_email: 接收邮箱
        subject: 邮件标题
        content: 邮件内容（支持HTML）
    Returns:
        bool: 是否发送成功
    """
    try:
        msg = MIMEText(content, 'html', 'utf-8')
        msg['From'] = formataddr(("GADA部署助手", SENDER_EMAIL))
        msg['To'] = receiver_email
        msg['Subject'] = subject

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, [receiver_email], msg.as_string())
        server.quit()
        logger.info(f"邮件通知已发送到 {receiver_email}")
        return True
    except Exception as e:
        logger.error(f"邮件发送失败: {str(e)}")
        return False
