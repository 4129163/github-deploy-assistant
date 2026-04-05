package models

import (
	"time"
)

// Comment 表示用户评论
type Comment struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"projectId"`
	UserID      string    `json:"userId"`
	UserName    string    `json:"userName"`
	UserEmail   string    `json:"userEmail"`
	Content     string    `json:"content"`
	Rating      float64   `json:"rating"` // 1-5星评分
	Helpful     int       `json:"helpful"` // 有帮助的投票数
	NotHelpful  int       `json:"notHelpful"` // 无帮助的投票数
	IsVerified  bool      `json:"isVerified"` // 是否已验证用户（已部署过）
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// IssueReport 表示问题报告
type IssueReport struct {
	ID             string    `json:"id"`
	ProjectID      string    `json:"projectId"`
	UserID         string    `json:"userId"`
	UserName       string    `json:"userName"`
	UserEmail      string    `json:"userEmail"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	IssueType      string    `json:"issueType"` // bug, feature_request, question, etc.
	Status         string    `json:"status"`    // open, in_progress, resolved, closed
	Priority       string    `json:"priority"`  // low, medium, high, critical
	Environment    string    `json:"environment"` // 环境信息JSON
	GitHubIssueURL string    `json:"githubIssueUrl"` // GitHub Issue链接
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
	ResolvedAt     *time.Time `json:"resolvedAt,omitempty"`
}

// ProjectStats 表示项目统计信息
type ProjectStats struct {
	ProjectID        string  `json:"projectId"`
	TotalComments    int     `json:"totalComments"`
	AverageRating    float64 `json:"averageRating"`
	TotalRatings     int     `json:"totalRatings"`
	TotalIssues      int     `json:"totalIssues"`
	OpenIssues       int     `json:"openIssues"`
	ResolvedIssues   int     `json:"resolvedIssues"`
	DeploymentCount  int     `json:"deploymentCount"`
}

// CreateCommentRequest 创建评论请求
type CreateCommentRequest struct {
	ProjectID string  `json:"projectId"`
	UserName  string  `json:"userName"`
	UserEmail string  `json:"userEmail"`
	Content   string  `json:"content"`
	Rating    float64 `json:"rating"`
}

// CreateIssueRequest 创建问题报告请求
type CreateIssueRequest struct {
	ProjectID   string `json:"projectId"`
	UserName    string `json:"userName"`
	UserEmail   string `json:"userEmail"`
	Title       string `json:"title"`
	Description string `json:"description"`
	IssueType   string `json:"issueType"`
	Priority    string `json:"priority"`
	Environment string `json:"environment"` // JSON格式的环境信息
}

// VoteCommentRequest 投票评论请求
type VoteCommentRequest struct {
	CommentID string `json:"commentId"`
	Helpful   bool   `json:"helpful"` // true表示有帮助，false表示无帮助
}

// UpdateIssueStatusRequest 更新问题状态请求
type UpdateIssueStatusRequest struct {
	Status string `json:"status"`
}

// CommentResponse 评论响应
type CommentResponse struct {
	Comment Comment `json:"comment"`
	CanEdit bool    `json:"canEdit"` // 当前用户是否可以编辑
}

// IssueResponse 问题响应
type IssueResponse struct {
	Issue  IssueReport `json:"issue"`
	CanEdit bool       `json:"canEdit"` // 当前用户是否可以编辑
}