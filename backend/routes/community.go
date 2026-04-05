package routes

import (
	"github.com/gorilla/mux"
	
	"github-deploy-assistant-backend/handlers"
)

// SetupCommunityRoutes 设置社区协作相关路由
func SetupCommunityRoutes(router *mux.Router) {
	// 评论相关路由
	router.HandleFunc("/api/projects/{projectId}/comments", handlers.GetProjectComments).Methods("GET")
	router.HandleFunc("/api/comments", handlers.CreateComment).Methods("POST")
	router.HandleFunc("/api/comments/{commentId}/vote", handlers.VoteComment).Methods("POST")
	
	// 问题报告相关路由
	router.HandleFunc("/api/projects/{projectId}/issues", handlers.GetProjectIssues).Methods("GET")
	router.HandleFunc("/api/issues", handlers.CreateIssue).Methods("POST")
	router.HandleFunc("/api/issues/{issueId}", handlers.UpdateIssueStatus).Methods("PUT")
	router.HandleFunc("/api/projects/{projectId}/issues/sync", handlers.SyncGitHubIssues).Methods("POST")
	
	// 项目统计路由
	router.HandleFunc("/api/projects/{projectId}/stats", handlers.GetProjectStatsHandler).Methods("GET")
}

// 需要在handlers中添加以下函数
// UpdateIssueStatus - 更新问题状态
// GetProjectStatsHandler - 获取项目统计信息
// SyncGitHubIssues - 同步GitHub Issues