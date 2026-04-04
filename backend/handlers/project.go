package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/google/uuid"
	
	"github-deploy-assistant-backend/models"
)

var (
	projects   []models.Project
	activities []models.Activity
)

// InitializeData 初始化数据
func InitializeData() {
	// 这里可以添加从文件加载数据的逻辑
	// 暂时使用默认数据
	now := time.Now()
	
	projects = []models.Project{
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

	activities = []models.Activity{
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
}

// GetProjects 获取所有项目
func GetProjects(w http.ResponseWriter, r *http.Request) {
	response := models.APIResponse{
		Success: true,
		Data:    projects,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetProject 获取单个项目
func GetProject(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	
	for _, project := range projects {
		if project.ID == id {
			response := models.APIResponse{
				Success: true,
				Data:    project,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
			return
		}
	}
	
	response := models.APIResponse{
		Success: false,
		Error:   "项目不存在",
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	json.NewEncoder(w).Encode(response)
}

// CreateProject 创建项目
func CreateProject(w http.ResponseWriter, r *http.Request) {
	var req models.CreateProjectRequest
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response := models.APIResponse{
			Success: false,
			Error:   "无效的请求数据",
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}
	
	now := time.Now()
	newProject := models.Project{
		ID:         uuid.New().String(),
		Name:       req.Name,
		Type:       req.Type,
		Port:       req.Port,
		Path:       req.Path,
		Status:     "stopped",
		LastActive: now,
		CreatedAt:  now,
	}
	
	projects = append(projects, newProject)
	
	// 记录活动
	newActivity := models.Activity{
		ID:        uuid.New().String(),
		Type:      "create",
		Project:   newProject.Name,
		Message:   "项目已创建",
		Timestamp: now,
		Success:   true,
	}
	activities = append(activities, newActivity)
	
	response := models.APIResponse{
		Success: true,
		Data:    newProject,
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// UpdateProject 更新项目
func UpdateProject(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	
	var req models.UpdateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response := models.APIResponse{
			Success: false,
			Error:   "无效的请求数据",
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}
	
	for i, project := range projects {
		if project.ID == id {
			// 更新字段
			if req.Name != "" {
				projects[i].Name = req.Name
			}
			if req.Type != "" {
				projects[i].Type = req.Type
			}
			if req.Port != 0 {
				projects[i].Port = req.Port
			}
			if req.Path != "" {
				projects[i].Path = req.Path
			}
			if req.Status != "" {
				projects[i].Status = req.Status
			}
			projects[i].LastActive = time.Now()
			
			// 记录活动
			newActivity := models.Activity{
				ID:        uuid.New().String(),
				Type:      "update",
				Project:   projects[i].Name,
				Message:   "项目已更新",
				Timestamp: time.Now(),
				Success:   true,
			}
			activities = append(activities, newActivity)
			
			response := models.APIResponse{
				Success: true,
				Data:    projects[i],
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
			return
		}
	}
	
	response := models.APIResponse{
		Success: false,
		Error:   "项目不存在",
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	json.NewEncoder(w).Encode(response)
}

// DeleteProject 删除项目
func DeleteProject(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	
	for i, project := range projects {
		if project.ID == id {
			// 记录活动
			newActivity := models.Activity{
				ID:        uuid.New().String(),
				Type:      "delete",
				Project:   project.Name,
				Message:   "项目已删除",
				Timestamp: time.Now(),
				Success:   true,
			}
			activities = append(activities, newActivity)
			
			// 删除项目
			projects = append(projects[:i], projects[i+1:]...)
			
			response := models.APIResponse{
				Success: true,
				Data:    "项目已删除",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
			return
		}
	}
	
	response := models.APIResponse{
		Success: false,
		Error:   "项目不存在",
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	json.NewEncoder(w).Encode(response)
}