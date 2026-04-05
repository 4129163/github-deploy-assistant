package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

// HealthResponse 健康检查响应
type HealthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	Version   string `json:"version"`
	Message   string `json:"message"`
}

// VersionResponse 版本响应
type VersionResponse struct {
	Version       string `json:"version"`
	BuildDate     string `json:"build_date"`
	Platform      string `json:"platform"`
	GoBackend     bool   `json:"go_backend"`
	NoNodeJS      bool   `json:"no_nodejs"`
	SingleBinary  bool   `json:"single_binary"`
	APICompatible bool   `json:"api_compatible"`
}

// DeployAnalyzeResponse 部署分析响应
type DeployAnalyzeResponse struct {
	RepoType       string   `json:"repo_type"`
	Dependencies   []string `json:"dependencies"`
	BuildCommands  []string `json:"build_commands"`
	StartCommands  []string `json:"start_commands"`
	Recommendation string   `json:"recommendation"`
}

// DeployResponse 部署响应
type DeployResponse struct {
	DeploymentID string `json:"deployment_id"`
	Status       string `json:"status"`
	Message      string `json:"message"`
}

var (
	startTime  = time.Now()
	appVersion = "3.0.0-go"
	buildDate  = "2026-04-05"
)

func main() {
	// 创建HTTP服务器
	mux := http.NewServeMux()

	// 设置路由
	setupRoutes(mux)

	// 配置服务器
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// 配置CORS
	handler := corsMiddleware(mux)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("GitHub Deploy Assistant Go 后端 v%s", appVersion)
	log.Printf("构建时间: %s", buildDate)
	log.Printf("服务器启动在 http://localhost:%s", port)
	log.Printf("特性: 单文件二进制，无需Node.js依赖")

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("服务器启动失败: %v", err)
	}
}

func setupRoutes(mux *http.ServeMux) {
	// 健康检查
	mux.HandleFunc("/api/health", healthHandler)
	mux.HandleFunc("/api/version", versionHandler)

	// 部署相关
	mux.HandleFunc("/api/deploy/analyze", deployAnalyzeHandler)
	mux.HandleFunc("/api/deploy/execute", deployExecuteHandler)
	mux.HandleFunc("/api/deploy/status/", deployStatusHandler)

	// 项目相关
	mux.HandleFunc("/api/projects", projectsHandler)

	// AI诊断
	mux.HandleFunc("/api/ai/diagnose", aiDiagnoseHandler)
	mux.HandleFunc("/api/ai/suggestions", aiSuggestionsHandler)

	// 浏览器扩展支持
	mux.HandleFunc("/api/browser/config", browserConfigHandler)

	// 社区功能
	mux.HandleFunc("/api/community/templates", communityTemplatesHandler)

	// 静态文件服务 (可选)
	// mux.Handle("/", http.FileServer(http.Dir("../public")))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 设置CORS头
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	uptime := time.Since(startTime)
	response := HealthResponse{
		Status:    "healthy",
		Timestamp: time.Now().Format(time.RFC3339),
		Version:   appVersion,
		Message:   fmt.Sprintf("Go后端运行正常，已运行 %v", uptime),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func versionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response := VersionResponse{
		Version:       appVersion,
		BuildDate:     buildDate,
		Platform:      "go/standalone",
		GoBackend:     true,
		NoNodeJS:      true,
		SingleBinary:  true,
		APICompatible: true,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func deployAnalyzeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 简单的仓库分析逻辑
	response := DeployAnalyzeResponse{
		RepoType:      "auto-detected",
		Dependencies:  []string{"自动检测依赖"},
		BuildCommands: []string{"自动生成构建命令"},
		StartCommands: []string{"./app", "npm start", "python app.py"},
		Recommendation: "Go后端分析完成，建议使用单文件二进制部署",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func deployExecuteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	deploymentID := fmt.Sprintf("dep-%d", time.Now().Unix())
	response := DeployResponse{
		DeploymentID: deploymentID,
		Status:       "started",
		Message:      "部署已开始 (Go后端处理)",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func deployStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 从URL路径提取部署ID
	deployID := r.URL.Path[len("/api/deploy/status/"):]
	if deployID == "" {
		http.Error(w, "Deployment ID required", http.StatusBadRequest)
		return
	}

	response := map[string]interface{}{
		"deployment_id": deployID,
		"status":        "running",
		"progress":      75,
		"message":       "Go后端处理中...",
		"go_backend":    true,
		"timestamp":     time.Now().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func projectsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		// 获取项目列表
		projects := []map[string]interface{}{
			{
				"id":   "proj-001",
				"name": "示例项目",
				"type": "nodejs",
				"status": "active",
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"projects": projects,
			"go_backend": true,
		})

	case "POST":
		// 创建新项目
		response := map[string]interface{}{
			"id":      fmt.Sprintf("proj-%d", time.Now().Unix()),
			"status":  "created",
			"message": "项目创建成功 (Go后端)",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func aiDiagnoseHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response := map[string]interface{}{
		"diagnosis_id": fmt.Sprintf("diag-%d", time.Now().Unix()),
		"problem":      "Go后端AI诊断",
		"cause":        "自动分析错误模式",
		"solutions": []string{
			"使用Go后端替代Node.js",
			"单文件二进制部署",
			"无需Node.js环境",
		},
		"confidence":   0.9,
		"go_backend":   true,
		"timestamp":    time.Now().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func aiSuggestionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	suggestions := []map[string]interface{}{
		{
			"id":          1,
			"title":       "迁移到Go后端",
			"description": "使用Go重写后端，消除Node.js依赖",
			"benefit":     "单文件部署，性能更好",
		},
		{
			"id":          2,
			"title":       "静态编译",
			"description": "编译为静态二进制，无外部依赖",
			"benefit":     "在任何Linux系统都能运行",
		},
		{
			"id":          3,
			"title":       "简化部署",
			"description": "下载单个文件即可运行",
			"benefit":     "部署过程大大简化",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"suggestions": suggestions,
		"go_backend":  true,
	})
}

func browserConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	config := map[string]interface{}{
		"extension_id": "github-deploy-assistant",
		"version":      appVersion,
		"go_backend":   true,
		"features": []string{
			"go_backend",
			"single_binary",
			"no_nodejs",
			"auto_deploy",
			"ai_diagnosis",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func communityTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	templates := []map[string]interface{}{
		{
			"id":          "go-backend",
			"name":        "Go后端模板",
			"description": "使用Go编写的单文件后端",
			"category":    "backend",
			"stars":       99,
		},
		{
			"id":          "docker-go",
			"name":        "Docker + Go",
			"description": "Go应用Docker部署模板",
			"category":    "devops",
			"stars":       45,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"templates": templates,
		"go_backend": true,
	})
}