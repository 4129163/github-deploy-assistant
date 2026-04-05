package routes

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	
	"github-deploy-assistant-backend/handlers"
)

// SetupRoutes 设置所有路由
func SetupRoutes(router *mux.Router) {
	// 健康检查
	router.HandleFunc("/api/health", handlers.HealthCheck).Methods("GET")
	
	// 项目路由
	router.HandleFunc("/api/projects", handlers.GetProjects).Methods("GET")
	router.HandleFunc("/api/projects/{id}", handlers.GetProject).Methods("GET")
	router.HandleFunc("/api/projects", handlers.CreateProject).Methods("POST")
	router.HandleFunc("/api/projects/{id}", handlers.UpdateProject).Methods("PUT")
	router.HandleFunc("/api/projects/{id}", handlers.DeleteProject).Methods("DELETE")
	
	// 活动路由
	router.HandleFunc("/api/activities", handlers.GetActivities).Methods("GET")
	router.HandleFunc("/api/activities", handlers.CreateActivity).Methods("POST")
	
	// 社区协作路由
	SetupCommunityRoutes(router)
	
	// 404 处理
	router.NotFoundHandler = http.HandlerFunc(notFoundHandler)
}

// notFoundHandler 404 处理器
func notFoundHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	
	response := map[string]interface{}{
		"success": false,
		"error":   "资源不存在",
		"path":    r.URL.Path,
	}
	
	json.NewEncoder(w).Encode(response)
}