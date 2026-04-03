import datetime
from functools import wraps
from .mail_sender import send_mail
from ..config import get_settings

settings = get_settings()

def mail_notify(subject_template, content_template):
    """邮件通知装饰器，用于函数执行后发送通知
    Args:
        subject_template: 邮件标题模板，支持{变量}占位符
        content_template: 邮件内容模板，支持{变量}占位符
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            try:
                if settings.mail.enabled and settings.mail.receiver_email:
                    # 组装模板变量
                    variables = {
                        "time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "result": result,
                        **kwargs
                    }
                    subject = subject_template.format(**variables)
                    content = content_template.format(**variables)
                    # 补充通用内容
                    content += """
                    <br><br>
                    <p>此邮件由GADA自动化部署助手自动发送，请勿直接回复。</p>
                    <p>访问 <a href="http://localhost:3000">GADA控制台</a> 查看详情。</p>
                    """
                    send_mail(settings.mail.receiver_email, subject, content)
            except Exception as e:
                pass
            return result
        return wrapper
    return decorator

# 预设场景装饰器
notify_deploy_success = mail_notify(
    "✅ 项目部署成功 - {project_name}",
    """
    <h3>项目部署成功通知</h3>
    <p>项目名称：{project_name}</p>
    <p>部署时间：{time}</p>
    <p>访问地址：<a href="{access_url}">{access_url}</a></p>
    """
)

notify_deploy_fail = mail_notify(
    "❌ 项目部署失败 - {project_name}",
    """
    <h3>项目部署失败通知</h3>
    <p>项目名称：{project_name}</p>
    <p>部署时间：{time}</p>
    <p>失败原因：{error_msg}</p>
    """
)

notify_resource_warning = mail_notify(
    "⚠️ 系统资源不足预警",
    """
    <h3>系统资源不足预警通知</h3>
    <p>预警时间：{time}</p>
    <p>当前资源使用率：{usage_rate}%</p>
    <p>建议及时关闭闲置项目，避免系统卡顿。</p>
    """
)

notify_version_update = mail_notify(
    "🔄 版本更新完成 - {project_name}",
    """
    <h3>版本更新完成通知</h3>
    <p>项目名称：{project_name}</p>
    <p>更新时间：{time}</p>
    <p>新版本号：{new_version}</p>
    """
)

notify_backup_success = mail_notify(
    "💾 仓库备份成功 - {repo_name}",
    """
    <h3>仓库备份成功通知</h3>
    <p>仓库名称：{repo_name}</p>
    <p>备份时间：{time}</p>
    <p>存储路径：{local_path}</p>
    """
)
