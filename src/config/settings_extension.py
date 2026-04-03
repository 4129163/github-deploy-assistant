# 邮件通知设置扩展
from pydantic import BaseModel
from typing import Optional

class MailSettings(BaseModel):
    """邮件通知配置"""
    enabled: bool = False
    receiver_email: Optional[str] = None
    notify_on_deploy_success: bool = True
    notify_on_deploy_fail: bool = True
    notify_on_error: bool = True
    notify_on_repair: bool = True
    notify_on_version_update: bool = True
    notify_on_version_rollback: bool = True
    notify_on_resource_warning: bool = True
    notify_on_backup_success: bool = True
    notify_on_backup_fail: bool = True

# 默认配置
DEFAULT_MAIL_SETTINGS = MailSettings()

# 前端设置页面配置项
SETTINGS_PAGE_ITEMS = [
    {
        "group": "通知设置",
        "items": [
            {
                "key": "mail_notification_enabled",
                "label": "启用邮件通知",
                "type": "switch",
                "default": False,
                "description": "开启后关键事件将同步发送邮件到您填写的邮箱"
            },
            {
                "key": "receiver_email",
                "label": "接收邮箱",
                "type": "input",
                "placeholder": "请填写接收通知的邮箱地址",
                "description": "所有通知将发送到这个邮箱"
            },
            {
                "key": "notify_scenarios",
                "label": "通知场景",
                "type": "checkbox",
                "options": [
                    {"label": "项目部署成功", "value": "deploy_success", "default": True},
                    {"label": "项目部署失败", "value": "deploy_fail", "default": True},
                    {"label": "项目运行出错", "value": "error", "default": True},
                    {"label": "故障修复完成", "value": "repair", "default": True},
                    {"label": "检测到新版本", "value": "version_update", "default": True},
                    {"label": "版本更新/回退完成", "value": "version_change", "default": True},
                    {"label": "系统资源不足预警", "value": "resource_warning", "default": True},
                    {"label": "仓库备份成功", "value": "backup_success", "default": True},
                    {"label": "仓库备份失败", "value": "backup_fail", "default": True},
                ],
                "description": "选择需要接收邮件通知的场景"
            }
        ]
    }
]
