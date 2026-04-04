package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github-deploy-assistant-backend/models"
)

var startTime = time.Now()

// HealthCheck 健康检查
func HealthCheck(w http.ResponseWriter, r *http.Request) {
	response := models.HealthResponse{
		Status:    "ok",
		Timestamp: time.Now().Format(time.RFC3339),
		Uptime:    time.Since(startTime).Seconds(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetActivities 获取所有活动
func GetActivities(w http.ResponseWriter, r *http.Request) {
	response := models.APIResponse{
		Success: true,
		Data:    activities,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CreateActivity 创建活动
func CreateActivity(w http.ResponseWriter, r *http.Request) {
	var activity models.Activity
	
	if err := json.NewDecoder(r.Body).Decode(&activity); err != nil {
		response := models.APIResponse{
			Success: false,
			Error:   "无效的活动数据",
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}
	
	// 设置默认值
	if activity.ID == "" {
		activity.ID = uuid.New().String()
	}
	if activity.Timestamp.IsZero() {
		activity.Timestamp = time.Now()
	}
	
	activities = append(activities, activity)
	
	response := models.APIResponse{
		Success: true,
		Data:    activity,
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}