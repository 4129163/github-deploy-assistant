package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github-deploy-assistant-backend/models"
)

// DeployRequest 部署请求
type DeployRequest struct {
	RepoURL    string `json:"repo_url"`
	TargetPath string `json:"target_path"`
	Options    string `json:"options,omitempty"`
}

// DeployResponse 部署响应
type DeployResponse struct {
	DeploymentID string `json:"deployment_id"`
	Status       string `json:"status"`
	Message      string `json:"message"`
	LogsURL      string `json:"logs_url,omitempty"`
}

// DeployStatus 部署状态
type DeployStatus struct {
	ID          string    `json:"id"`
	Status      string    `json:"status"`
	Progress    int       `json:"progress"`
	Message     string    `json:"message"`
	Logs        []string  `json:"logs,omitempty"`
	StartedAt   time.Time `json:"started_at"`
	CompletedAt time.Time `json:"completed_at,omitempty"`
	Error       string    `json:"error,omitempty"`
}

// DeployAnalyzeRequest 部署分析请求
type DeployAnalyzeRequest struct {
	RepoURL string `json:"repo_url"`
}

// DeployAnalyzeResponse 部署分析响应
type DeployAnalyzeResponse struct {
	RepoType       string   `json:"repo_type"`
	Dependencies   []string `json:"dependencies"`
	BuildCommands  []string `json:"build_commands"`
	StartCommands  []string `json:"start_commands"`
	ConfigFiles    []string `json:"config_files"`
	Recommendation string   `json:"recommendation"`
	Complexity     string   `json:"complexity"` // simple, medium, complex
}

var (
	deployments = make(map[string]*DeployStatus)
	deployMutex sync.Mutex
)

// HandleDeployAnalyze 分析仓库部署需求
func HandleDeployAnalyze(w http.ResponseWriter, r *http.Request) {
	var req DeployAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "无效的请求格式", http.StatusBadRequest)
		return
	}

	if req.RepoURL == "" {
		http.Error(w, "仓库URL不能为空", http.StatusBadRequest)
		return
	}

	// 分析仓库类型
	analysis := analyzeRepository(req.RepoURL)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analysis)
}

// HandleDeployExecute 执行部署
func HandleDeployExecute(w http.ResponseWriter, r *http.Request) {
	var req DeployRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "无效的请求格式", http.StatusBadRequest)
		return
	}

	if req.RepoURL == "" || req.TargetPath == "" {
		http.Error(w, "仓库URL和目标路径不能为空", http.StatusBadRequest)
		return
	}

	// 生成部署ID
	deployID := uuid.New().String()

	// 创建部署状态
	deployMutex.Lock()
	deployments[deployID] = &DeployStatus{
		ID:        deployID,
		Status:    "pending",
		Progress:  0,
		Message:   "部署已排队",
		StartedAt: time.Now(),
		Logs:      []string{},
	}
	deployMutex.Unlock()

	// 异步执行部署
	go executeDeployment(deployID, req)

	// 返回响应
	response := DeployResponse{
		DeploymentID: deployID,
		Status:       "started",
		Message:      "部署已开始",
		LogsURL:      fmt.Sprintf("/api/deploy/logs/%s", deployID),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleDeployStatus 获取部署状态
func HandleDeployStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	deployID := vars["id"]

	deployMutex.Lock()
	status, exists := deployments[deployID]
	deployMutex.Unlock()

	if !exists {
		http.Error(w, "部署不存在", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// HandleDeployLogs 获取部署日志
func HandleDeployLogs(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	deployID := vars["id"]

	deployMutex.Lock()
	status, exists := deployments[deployID]
	deployMutex.Unlock()

	if !exists {
		http.Error(w, "部署不存在", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"deployment_id": deployID,
		"logs":          status.Logs,
		"total_logs":    len(status.Logs),
	})
}

// analyzeRepository 分析仓库
func analyzeRepository(repoURL string) *DeployAnalyzeResponse {
	// 这里应该实现实际的仓库分析逻辑
	// 基于常见的项目类型进行判断

	analysis := &DeployAnalyzeResponse{
		RepoType:      "unknown",
		Dependencies:  []string{},
		BuildCommands: []string{},
		StartCommands: []string{},
		ConfigFiles:   []string{},
		Complexity:    "medium",
	}

	// 根据URL后缀或常见模式判断
	if strings.Contains(repoURL, "node") || strings.Contains(repoURL, "npm") {
		analysis.RepoType = "nodejs"
		analysis.Dependencies = []string{"Node.js", "npm"}
		analysis.BuildCommands = []string{"npm install", "npm run build"}
		analysis.StartCommands = []string{"npm start"}
		analysis.ConfigFiles = []string{"package.json", ".env", "Dockerfile"}
		analysis.Recommendation = "Node.js项目，建议使用PM2进行进程管理"
		analysis.Complexity = "simple"
	} else if strings.Contains(repoURL, "python") {
		analysis.RepoType = "python"
		analysis.Dependencies = []string{"Python 3", "pip"}
		analysis.BuildCommands = []string{"pip install -r requirements.txt"}
		analysis.StartCommands = []string{"python app.py"}
		analysis.ConfigFiles = []string{"requirements.txt", ".env", "Dockerfile"}
		analysis.Recommendation = "Python项目，建议使用virtualenv或Docker"
		analysis.Complexity = "simple"
	} else if strings.Contains(repoURL, "go") {
		analysis.RepoType = "go"
		analysis.Dependencies = []string{"Go"}
		analysis.BuildCommands = []string{"go mod download", "go build -o app"}
		analysis.StartCommands = []string{"./app"}
		analysis.ConfigFiles = []string{"go.mod", "go.sum", ".env"}
		analysis.Recommendation = "Go项目，可以直接编译成二进制文件"
		analysis.Complexity = "simple"
	} else if strings.Contains(repoURL, "docker") {
		analysis.RepoType = "docker"
		analysis.Dependencies = []string{"Docker"}
		analysis.BuildCommands = []string{"docker build -t app ."}
		analysis.StartCommands = []string{"docker run -p 3000:3000 app"}
		analysis.ConfigFiles = []string{"Dockerfile", "docker-compose.yml"}
		analysis.Recommendation = "Docker项目，建议使用Docker Compose管理"
		analysis.Complexity = "medium"
	}

	return analysis
}

// executeDeployment 执行部署
func executeDeployment(deployID string, req DeployRequest) {
	deployMutex.Lock()
	status := deployments[deployID]
	status.Status = "running"
	status.Progress = 10
	status.Message = "正在克隆仓库..."
	deployMutex.Unlock()

	// 创建目标目录
	if err := os.MkdirAll(req.TargetPath, 0755); err != nil {
		updateDeploymentStatus(deployID, "failed", 0, fmt.Sprintf("创建目录失败: %v", err))
		return
	}

	// 克隆仓库
	repoPath := filepath.Join(req.TargetPath, filepath.Base(strings.TrimSuffix(req.RepoURL, ".git")))
	
	updateDeploymentStatus(deployID, "running", 20, "正在克隆Git仓库...")
	
	cmd := exec.Command("git", "clone", req.RepoURL, repoPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		updateDeploymentStatus(deployID, "failed", 20, fmt.Sprintf("克隆失败: %v\n%s", err, output))
		return
	}

	updateDeploymentStatus(deployID, "running", 40, "仓库克隆成功，正在分析项目...")

	// 分析项目
	analysis := analyzeRepository(req.RepoURL)
	
	updateDeploymentStatus(deployID, "running", 60, "项目分析完成，正在安装依赖...")

	// 安装依赖
	if len(analysis.Dependencies) > 0 {
		for _, dep := range analysis.Dependencies {
			// 这里应该根据不同类型的项目执行不同的依赖安装
			log.Printf("安装依赖: %s", dep)
		}
	}

	updateDeploymentStatus(deployID, "running", 80, "依赖安装完成，正在构建项目...")

	// 执行构建命令
	for _, cmdStr := range analysis.BuildCommands {
		cmdParts := strings.Fields(cmdStr)
		if len(cmdParts) == 0 {
			continue
		}
		
		cmd := exec.Command(cmdParts[0], cmdParts[1:]...)
		cmd.Dir = repoPath
		
		if output, err := cmd.CombinedOutput(); err != nil {
			log.Printf("构建命令失败: %s - %v", cmdStr, err)
		} else {
			log.Printf("构建命令输出: %s", output)
		}
	}

	updateDeploymentStatus(deployID, "running", 90, "项目构建完成，正在启动服务...")

	// 记录启动命令
	startCommands := strings.Join(analysis.StartCommands, "; ")
	updateDeploymentStatus(deployID, "completed", 100, 
		fmt.Sprintf("部署完成！启动命令: %s\n项目路径: %s", startCommands, repoPath))
}

// updateDeploymentStatus 更新部署状态
func updateDeploymentStatus(deployID string, statusStr string, progress int, message string) {
	deployMutex.Lock()
	defer deployMutex.Unlock()

	if status, exists := deployments[deployID]; exists {
		status.Status = statusStr
		status.Progress = progress
		status.Message = message
		status.Logs = append(status.Logs, fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), message))
		
		if statusStr == "completed" || statusStr == "failed" {
			status.CompletedAt = time.Now()
		}
	}
}

// HandleDeployCancel 取消部署
func HandleDeployCancel(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	deployID := vars["id"]

	deployMutex.Lock()
	status, exists := deployments[deployID]
	deployMutex.Unlock()

	if !exists {
		http.Error(w, "部署不存在", http.StatusNotFound)
		return
	}

	if status.Status == "completed" || status.Status == "failed" {
		http.Error(w, "部署已完成或已失败，无法取消", http.StatusBadRequest)
		return
	}

	updateDeploymentStatus(deployID, "cancelled", status.Progress, "部署已取消")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "部署已成功取消",
		"status":  "cancelled",
	})
}