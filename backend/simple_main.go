package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// 项目结构
type Project struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Type       string    `json:"type"`
	Port       int       `json:"port"`
	Path       string    `json:"path"`
	Status     string    `json:"status"`
	LastActive time.Time `json:"lastActive"`
	CreatedAt  time.Time `json:"createdAt"`
}

// 活动结构
type Activity struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Project   string    `json:"project"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	Success   bool      `json:"success"`
}

// API 响应
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

var (
	projects   []Project
	activities []Activity
	startTime  = time.Now()
)

func main() {
	// 初始化数据
	initializeData()

	// 设置路由
	http.HandleFunc("/api/health", healthCheck)
	http.HandleFunc("/api/projects", projectsHandler)
	http.HandleFunc("/api/activities", activitiesHandler)
	
	// 静态文件服务
	fs := http.FileServer(http.Dir("../public"))
	http.Handle("/", fs)

	// 启动服务器
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("GitHub Deploy Assistant Go 后端启动在 http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func initializeData() {
	now := time.Now()
	
	projects = []Project{
		{
			ID:         "1",
			Name:       "my-react-app",
			Type:       "React",
			Port:       3000,
			Path:       "/home/user/projects/my-react-app",
			Status:     "running",
			LastActive: now,
			CreatedAt:  now,
		},
		{
			ID:         "2",
			Name:       "api-service",
			Type:       "Node.js",
			Port:       8080,
			Path:       "/home/user/projects/api-service",
			Status:     "stopped",
			LastActive: now,
			CreatedAt:  now,
		},
	}

	activities = []Activity{
		{
			ID:        "1",
			Type:      "start",
			Project:   "my-react-app",
			Message:   "项目已启动",
			Timestamp: now,
			Success:   true,
		},
		{
			ID:        "2",
			Type:      "deploy",
			Project:   "api-service",
			Message:   "部署完成",
			Timestamp: now,
			Success:   true,
		},
	}
	
	log.Println("数据初始化完成")
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	response := map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().Format(time.RFC3339),
		"uptime":    time.Since(startTime).Seconds(),
		"version":   "1.0.0",
		"backend":   "Go",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func projectsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	switch r.Method {
	case "GET":
		// 获取所有项目
		response := APIResponse{
			Success: true,
			Data:    projects,
		}
		json.NewEncoder(w).Encode(response)

	case "POST":
		// 创建新项目
		var newProject Project
		if err := json.NewDecoder(r.Body).Decode(&newProject); err != nil {
			response := APIResponse{
				Success: false,
				Error:   "无效的请求数据",
			}
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(response)
			return
		}

		// 设置默认值
		newProject.ID = fmt.Sprintf("%d", len(projects)+1)
		newProject.Status = "stopped"
		newProject.LastActive = time.Now()
		newProject.CreatedAt = time.Now()

		projects = append(projects, newProject)

		// 记录活动
		newActivity := Activity{
			ID:        fmt.Sprintf("%d", len(activities)+1),
			Type:      "create",
			Project:   newProject.Name,
			Message:   "项目已创建",
			Timestamp: time.Now(),
			Success:   true,
		}
		activities = append(activities, newActivity)

		response := APIResponse{
			Success: true,
			Data:    newProject,
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(response)

	default:
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
	}
}

func activitiesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method != "GET" {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	response := APIResponse{
		Success: true,
		Data:    activities,
	}
	json.NewEncoder(w).Encode(response)
}

// 简单的路由匹配
func routeHandler(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	
	switch {
	case path == "/api/health":
		healthCheck(w, r)
	case path == "/api/projects":
		projectsHandler(w, r)
	case path == "/api/activities":
		activitiesHandler(w, r)
	case strings.HasPrefix(path, "/api/projects/"):
		// 处理单个项目
		projectID := strings.TrimPrefix(path, "/api/projects/")
		projectHandler(w, r, projectID)
	default:
		http.NotFound(w, r)
	}
}

func projectHandler(w http.ResponseWriter, r *http.Request, projectID string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// 查找项目
	var foundProject *Project
	for i, project := range projects {
		if project.ID == projectID {
			foundProject = &projects[i]
			break
		}
	}

	if foundProject == nil {
		response := APIResponse{
			Success: false,
			Error:   "项目不存在",
		}
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(response)
		return
	}

	switch r.Method {
	case "GET":
		response := APIResponse{
			Success: true,
			Data:    foundProject,
		}
		json.NewEncoder(w).Encode(response)

	case "PUT":
		var updates Project
		if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
			response := APIResponse{
				Success: false,
				Error:   "无效的请求数据",
			}
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(response)
			return
		}

		// 更新字段
		if updates.Name != "" {
			foundProject.Name = updates.Name
		}
		if updates.Type != "" {
			foundProject.Type = updates.Type
		}
		if updates.Port != 0 {
			foundProject.Port = updates.Port
		}
		if updates.Path != "" {
			foundProject.Path = updates.Path
		}
		if updates.Status != "" {
			foundProject.Status = updates.Status
		}
		foundProject.LastActive = time.Now()

		// 记录活动
		newActivity := Activity{
			ID:        fmt.Sprintf("%d", len(activities)+1),
			Type:      "update",
			Project:   foundProject.Name,
			Message:   "项目已更新",
			Timestamp: time.Now(),
			Success:   true,
		}
		activities = append(activities, newActivity)

		response := APIResponse{
			Success: true,
			Data:    foundProject,
		}
		json.NewEncoder(w).Encode(response)

	case "DELETE":
		// 删除项目
		for i, project := range projects {
			if project.ID == projectID {
				// 记录活动
				newActivity := Activity{
					ID:        fmt.Sprintf("%d", len(activities)+1),
					Type:      "delete",
					Project:   project.Name,
					Message:   "项目已删除",
					Timestamp: time.Now(),
					Success:   true,
				}
				activities = append(activities, newActivity)

				// 删除项目
				projects = append(projects[:i], projects[i+1:]...)

				response := APIResponse{
					Success: true,
					Data:    "项目已删除",
				}
				json.NewEncoder(w).Encode(response)
				return
			}
		}

		response := APIResponse{
			Success: false,
			Error:   "项目不存在",
		}
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(response)

	default:
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
	}
}