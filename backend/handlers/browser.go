package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// BrowserConfig 浏览器配置
type BrowserConfig struct {
	ExtensionID  string   `json:"extension_id"`
	Version      string   `json:"version"`
	Permissions  []string `json:"permissions"`
	APIVersion   string   `json:"api_version"`
	Features     []string `json:"features"`
}

// BrowserActionRequest 浏览器动作请求
type BrowserActionRequest struct {
	Action    string                 `json:"action"`
	TargetURL string                 `json:"target_url,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	SessionID string                 `json:"session_id,omitempty"`
}

// BrowserActionResponse 浏览器动作响应
type BrowserActionResponse struct {
	Success   bool                   `json:"success"`
	Message   string                 `json:"message"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Timestamp string                 `json:"timestamp"`
}

// WebSocketClient WebSocket客户端
type WebSocketClient struct {
	conn     *websocket.Conn
	sessionID string
}

var (
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			// 允许所有来源，实际部署时应限制
			return true
		},
	}

	wsClients    = make(map[string]*WebSocketClient)
	wsClientsMux sync.Mutex
)

// HandleBrowserConfig 获取浏览器配置
func HandleBrowserConfig(w http.ResponseWriter, r *http.Request) {
	config := BrowserConfig{
		ExtensionID: "github-deploy-assistant",
		Version:     "2.0.0",
		Permissions: []string{
			"activeTab",
			"storage",
			"webNavigation",
			"tabs",
			"notifications",
		},
		APIVersion: "2.0",
		Features: []string{
			"repo_analysis",
			"deploy_automation",
			"error_diagnosis",
			"real_time_logs",
			"template_market",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// HandleBrowserAction 执行浏览器动作
func HandleBrowserAction(w http.ResponseWriter, r *http.Request) {
	var req BrowserActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "无效的请求格式", http.StatusBadRequest)
		return
	}

	if req.Action == "" {
		http.Error(w, "动作不能为空", http.StatusBadRequest)
		return
	}

	// 处理不同类型的动作
	response := handleBrowserAction(req)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleWebSocket WebSocket连接处理
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket升级失败: %v", err)
		return
	}
	defer conn.Close()

	// 生成会话ID
	sessionID := generateSessionID()
	client := &WebSocketClient{
		conn:      conn,
		sessionID: sessionID,
	}

	// 注册客户端
	wsClientsMux.Lock()
	wsClients[sessionID] = client
	wsClientsMux.Unlock()

	// 发送欢迎消息
	welcomeMsg := map[string]interface{}{
		"type":      "welcome",
		"session_id": sessionID,
		"message":   "WebSocket连接已建立",
		"timestamp": time.Now().Format(time.RFC3339),
	}
	conn.WriteJSON(welcomeMsg)

	// 处理消息
	for {
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket读取错误: %v", err)
			break
		}

		// 只处理文本消息
		if messageType != websocket.TextMessage {
			continue
		}

		// 处理接收到的消息
		handleWebSocketMessage(sessionID, message)
	}

	// 断开连接时清理
	wsClientsMux.Lock()
	delete(wsClients, sessionID)
	wsClientsMux.Unlock()
}

// handleBrowserAction 处理浏览器动作
func handleBrowserAction(req BrowserActionRequest) *BrowserActionResponse {
	response := &BrowserActionResponse{
		Success:   true,
		Timestamp: time.Now().Format(time.RFC3339),
	}

	switch req.Action {
	case "analyze_repo":
		response.Message = "仓库分析完成"
		response.Data = map[string]interface{}{
			"repo_type":      detectRepoType(req.TargetURL),
			"dependencies":   []string{"node", "npm", "docker"},
			"recommendation": "建议使用Docker部署",
		}

	case "deploy_now":
		response.Message = "部署已开始"
		response.Data = map[string]interface{}{
			"deployment_id": fmt.Sprintf("dep_%d", time.Now().Unix()),
			"status":        "started",
			"progress":      0,
		}

	case "get_logs":
		response.Message = "获取日志成功"
		response.Data = map[string]interface{}{
			"logs": []string{
				"[INFO] 开始部署...",
				"[INFO] 克隆仓库...",
				"[INFO] 安装依赖...",
			},
		}

	case "diagnose_error":
		errorLog, _ := req.Data["error_log"].(string)
		response.Message = "错误诊断完成"
		response.Data = map[string]interface{}{
			"diagnosis": analyzeBrowserError(errorLog),
		}

	case "save_template":
		response.Message = "模板保存成功"
		response.Data = map[string]interface{}{
			"template_id": fmt.Sprintf("tpl_%d", time.Now().Unix()),
			"saved_at":    time.Now().Format(time.RFC3339),
		}

	case "share_result":
		response.Message = "结果分享成功"
		response.Data = map[string]interface{}{
			"share_url": fmt.Sprintf("https://share.example.com/%d", time.Now().Unix()),
		}

	case "get_templates":
		response.Message = "获取模板列表成功"
		response.Data = map[string]interface{}{
			"templates": getBrowserTemplates(),
		}

	default:
		response.Success = false
		response.Message = "未知的动作类型"
		response.Data = map[string]interface{}{
			"supported_actions": []string{
				"analyze_repo",
				"deploy_now",
				"get_logs",
				"diagnose_error",
				"save_template",
				"share_result",
				"get_templates",
			},
		}
	}

	return response
}

// handleWebSocketMessage 处理WebSocket消息
func handleWebSocketMessage(sessionID string, message []byte) {
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		log.Printf("WebSocket消息解析失败: %v", err)
		return
	}

	msgType, _ := msg["type"].(string)

	switch msgType {
	case "subscribe_logs":
		deploymentID, _ := msg["deployment_id"].(string)
		go streamDeploymentLogs(sessionID, deploymentID)

	case "unsubscribe_logs":
		// 停止流式传输

	case "send_command":
		command, _ := msg["command"].(string)
		handleBrowserCommand(sessionID, command, msg["data"])

	case "ping":
		sendWebSocketMessage(sessionID, map[string]interface{}{
			"type": "pong",
			"timestamp": time.Now().Unix(),
		})

	default:
		log.Printf("未知的WebSocket消息类型: %s", msgType)
	}
}

// sendWebSocketMessage 发送WebSocket消息
func sendWebSocketMessage(sessionID string, data interface{}) {
	wsClientsMux.Lock()
	client, exists := wsClients[sessionID]
	wsClientsMux.Unlock()

	if exists && client != nil {
		client.conn.WriteJSON(data)
	}
}

// streamDeploymentLogs 流式传输部署日志
func streamDeploymentLogs(sessionID, deploymentID string) {
	// 模拟日志流
	for i := 1; i <= 10; i++ {
		time.Sleep(1 * time.Second)

		logMsg := map[string]interface{}{
			"type":          "log_update",
			"deployment_id": deploymentID,
			"log":           fmt.Sprintf("[INFO] 步骤 %d/10 完成", i),
			"progress":      i * 10,
			"timestamp":     time.Now().Format(time.RFC3339),
		}

		sendWebSocketMessage(sessionID, logMsg)
	}

	// 发送完成消息
	completeMsg := map[string]interface{}{
		"type":          "deployment_complete",
		"deployment_id": deploymentID,
		"status":        "completed",
		"message":       "部署完成",
		"timestamp":     time.Now().Format(time.RFC3339),
	}
	sendWebSocketMessage(sessionID, completeMsg)
}

// handleBrowserCommand 处理浏览器命令
func handleBrowserCommand(sessionID, command string, data interface{}) {
	response := map[string]interface{}{
		"type":      "command_response",
		"command":   command,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	switch command {
	case "pause_deployment":
		response["success"] = true
		response["message"] = "部署已暂停"

	case "resume_deployment":
		response["success"] = true
		response["message"] = "部署已恢复"

	case "cancel_deployment":
		response["success"] = true
		response["message"] = "部署已取消"

	case "get_status":
		response["success"] = true
		response["data"] = map[string]interface{}{
			"status":    "running",
			"progress":  50,
			"message":   "正在构建项目",
		}

	default:
		response["success"] = false
		response["message"] = "未知的命令"
	}

	sendWebSocketMessage(sessionID, response)
}

// detectRepoType 检测仓库类型
func detectRepoType(url string) string {
	urlLower := strings.ToLower(url)

	if strings.Contains(urlLower, "node") || strings.Contains(urlLower, "npm") {
		return "nodejs"
	} else if strings.Contains(urlLower, "python") {
		return "python"
	} else if strings.Contains(urlLower, "go") {
		return "go"
	} else if strings.Contains(urlLower, "docker") {
		return "docker"
	} else if strings.Contains(urlLower, "react") || strings.Contains(urlLower, "vue") {
		return "frontend"
	} else {
		return "unknown"
	}
}

// analyzeBrowserError 分析浏览器错误
func analyzeBrowserError(errorLog string) map[string]interface{} {
	analysis := make(map[string]interface{})

	errorLower := strings.ToLower(errorLog)

	if strings.Contains(errorLower, "cors") {
		analysis["problem"] = "CORS错误"
		analysis["solution"] = "配置服务器CORS头或使用浏览器扩展模式"
		analysis["severity"] = "medium"
	} else if strings.Contains(errorLower, "timeout") {
		analysis["problem"] = "请求超时"
		analysis["solution"] = "增加超时时间或检查网络连接"
		analysis["severity"] = "low"
	} else if strings.Contains(errorLower, "not found") {
		analysis["problem"] = "资源未找到"
		analysis["solution"] = "检查URL是否正确或服务是否启动"
		analysis["severity"] = "high"
	} else {
		analysis["problem"] = "未知错误"
		analysis["solution"] = "查看完整错误日志"
		analysis["severity"] = "unknown"
	}

	return analysis
}

// getBrowserTemplates 获取浏览器模板
func getBrowserTemplates() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"id":          "node-basic",
			"name":        "Node.js基础模板",
			"description": "标准的Node.js Express应用",
			"category":    "backend",
			"stars":       45,
		},
		{
			"id":          "react-ts",
			"name":        "React TypeScript",
			"description": "React + TypeScript + Vite模板",
			"category":    "frontend",
			"stars":       78,
		},
		{
			"id":          "docker-compose",
			"name":        "Docker Compose模板",
			"description": "多容器Docker部署配置",
			"category":    "devops",
			"stars":       32,
		},
		{
			"id":          "fastapi",
			"name":        "FastAPI Python",
			"description": "Python FastAPI后端模板",
			"category":    "backend",
			"stars":       23,
		},
	}
}

// generateSessionID 生成会话ID
func generateSessionID() string {
	return fmt.Sprintf("ws_%d_%d", time.Now().Unix(), time.Now().UnixNano()%1000)
}