package models

import (
	"time"
)

// Project 表示一个项目
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

// Activity 表示一个活动记录
type Activity struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Project   string    `json:"project"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	Success   bool      `json:"success"`
}

// HealthResponse 健康检查响应
type HealthResponse struct {
	Status    string  `json:"status"`
	Timestamp string  `json:"timestamp"`
	Uptime    float64 `json:"uptime"`
}

// APIResponse 通用 API 响应
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// CreateProjectRequest 创建项目请求
type CreateProjectRequest struct {
	Name string `json:"name"`
	Type string `json:"type"`
	Port int    `json:"port"`
	Path string `json:"path"`
}

// UpdateProjectRequest 更新项目请求
type UpdateProjectRequest struct {
	Name   string `json:"name,omitempty"`
	Type   string `json:"type,omitempty"`
	Port   int    `json:"port,omitempty"`
	Path   string `json:"path,omitempty"`
	Status string `json:"status,omitempty"`
}