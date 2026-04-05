package routes

import (
	"github.com/gorilla/mux"
	
	"github-deploy-assistant-backend/handlers"
)

// SetupAllRoutes 设置所有路由
func SetupAllRoutes(router *mux.Router) {
	// 健康检查
	router.HandleFunc("/api/health", handlers.HealthCheck).Methods("GET")
	router.HandleFunc("/api/version", handlers.GetVersion).Methods("GET")
	
	// 项目管理
	router.HandleFunc("/api/projects", handlers.GetProjects).Methods("GET")
	router.HandleFunc("/api/projects/{id}", handlers.GetProject).Methods("GET")
	router.HandleFunc("/api/projects", handlers.CreateProject).Methods("POST")
	router.HandleFunc("/api/projects/{id}", handlers.UpdateProject).Methods("PUT")
	router.HandleFunc("/api/projects/{id}", handlers.DeleteProject).Methods("DELETE")
	
	// 部署功能
	router.HandleFunc("/api/deploy/analyze", handlers.HandleDeployAnalyze).Methods("POST")
	router.HandleFunc("/api/deploy/execute", handlers.HandleDeployExecute).Methods("POST")
	router.HandleFunc("/api/deploy/status/{id}", handlers.HandleDeployStatus).Methods("GET")
	router.HandleFunc("/api/deploy/logs/{id}", handlers.HandleDeployLogs).Methods("GET")
	router.HandleFunc("/api/deploy/cancel/{id}", handlers.HandleDeployCancel).Methods("POST")
	
	// AI诊断功能
	router.HandleFunc("/api/ai/diagnose", handlers.HandleAIDiagnose).Methods("POST")
	router.HandleFunc("/api/ai/suggestions", handlers.HandleAISuggestions).Methods("GET")
	router.HandleFunc("/api/ai/fix", handlers.HandleAIFix).Methods("POST")
	
	// 社区功能
	SetupCommunityRoutes(router)
	
	// 浏览器扩展支持
	router.HandleFunc("/api/browser/config", handlers.HandleBrowserConfig).Methods("GET")
	router.HandleFunc("/api/browser/action", handlers.HandleBrowserAction).Methods("POST")
	router.HandleFunc("/ws/browser", handlers.HandleWebSocket).Methods("GET")
	
	// 静态文件服务 (可选)
	// router.PathPrefix("/").Handler(http.FileServer(http.Dir("../public")))
}