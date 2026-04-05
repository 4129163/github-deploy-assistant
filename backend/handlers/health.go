package handlers

import (
	"encoding/json"
	"net/http"
	"runtime"
	"time"
)

// HealthCheckResponse 健康检查响应
type HealthCheckResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	Uptime    string `json:"uptime"`
	Version   string `json:"version"`
}

// VersionResponse 版本信息响应
type VersionResponse struct {
	Version     string `json:"version"`
	BuildDate   string `json:"build_date"`
	GoVersion   string `json:"go_version"`
	Platform    string `json:"platform"`
	APICompatible bool `json:"api_compatible"`
}

var (
	startTime = time.Now()
	appVersion = "3.0.0"
	buildDate = "2026-04-05"
)

// HealthCheck 健康检查处理器
func HealthCheck(w http.ResponseWriter, r *http.Request) {
	uptime := time.Since(startTime)
	
	response := HealthCheckResponse{
		Status:    "healthy",
		Timestamp: time.Now().Format(time.RFC3339),
		Uptime:    formatDuration(uptime),
		Version:   appVersion,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetVersion 获取版本信息
func GetVersion(w http.ResponseWriter, r *http.Request) {
	response := VersionResponse{
		Version:       appVersion,
		BuildDate:     buildDate,
		GoVersion:     runtime.Version(),
		Platform:      runtime.GOOS + "/" + runtime.GOARCH,
		APICompatible: true,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// formatDuration 格式化持续时间
func formatDuration(d time.Duration) string {
	days := int(d.Hours() / 24)
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60
	seconds := int(d.Seconds()) % 60

	if days > 0 {
		return formatPlural(days, "天") + formatPlural(hours, "小时")
	} else if hours > 0 {
		return formatPlural(hours, "小时") + formatPlural(minutes, "分钟")
	} else if minutes > 0 {
		return formatPlural(minutes, "分钟") + formatPlural(seconds, "秒")
	} else {
		return formatPlural(seconds, "秒")
	}
}

// formatPlural 格式化复数
func formatPlural(count int, singular string) string {
	if count == 1 {
		return "1" + singular
	}
	return string(rune(count)) + singular
}

// InitializeData 初始化数据
func InitializeData() {
	// 这里可以初始化一些数据
	// 例如：创建默认项目、加载默认模板等
}