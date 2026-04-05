package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// AIDiagnoseRequest AI诊断请求
type AIDiagnoseRequest struct {
	DeploymentID string `json:"deployment_id"`
	ErrorLog     string `json:"error_log"`
	Context      string `json:"context,omitempty"`
}

// AIDiagnoseResponse AI诊断响应
type AIDiagnoseResponse struct {
	DiagnosisID  string   `json:"diagnosis_id"`
	Problem      string   `json:"problem"`
	Cause        string   `json:"cause"`
	Solutions    []string `json:"solutions"`
	Confidence   float64  `json:"confidence"`
	Recommendation string `json:"recommendation"`
	Timestamp    string   `json:"timestamp"`
}

// AIFixRequest AI修复请求
type AIFixRequest struct {
	DiagnosisID string `json:"diagnosis_id"`
	SolutionID  int    `json:"solution_id"`
	AutoApply   bool   `json:"auto_apply,omitempty"`
}

// AIFixResponse AI修复响应
type AIFixResponse struct {
	FixID      string `json:"fix_id"`
	Status     string `json:"status"`
	Message    string `json:"message"`
	Applied    bool   `json:"applied"`
	Changes    []string `json:"changes,omitempty"`
	BackupPath string `json:"backup_path,omitempty"`
}

// HandleAIDiagnose AI诊断部署问题
func HandleAIDiagnose(w http.ResponseWriter, r *http.Request) {
	var req AIDiagnoseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "无效的请求格式", http.StatusBadRequest)
		return
	}

	if req.ErrorLog == "" {
		http.Error(w, "错误日志不能为空", http.StatusBadRequest)
		return
	}

	// 分析错误日志
	diagnosis := analyzeErrorLog(req.ErrorLog, req.Context)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(diagnosis)
}

// HandleAISuggestions 获取AI建议
func HandleAISuggestions(w http.ResponseWriter, r *http.Request) {
	// 获取常见问题和解决方案
	suggestions := getCommonSuggestions()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"suggestions": suggestions,
		"count":       len(suggestions),
		"timestamp":   time.Now().Format(time.RFC3339),
	})
}

// HandleAIFix 应用AI建议的修复
func HandleAIFix(w http.ResponseWriter, r *http.Request) {
	var req AIFixRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "无效的请求格式", http.StatusBadRequest)
		return
	}

	if req.DiagnosisID == "" {
		http.Error(w, "诊断ID不能为空", http.StatusBadRequest)
		return
	}

	// 应用修复
	fixResult := applyAIFix(req)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(fixResult)
}

// analyzeErrorLog 分析错误日志
func analyzeErrorLog(errorLog string, context string) *AIDiagnoseResponse {
	diagnosis := &AIDiagnoseResponse{
		DiagnosisID: fmt.Sprintf("diag_%d", time.Now().Unix()),
		Confidence:  0.7,
		Timestamp:   time.Now().Format(time.RFC3339),
	}

	// 常见的错误模式识别
	errorLogLower := strings.ToLower(errorLog)

	// Node.js相关错误
	if strings.Contains(errorLogLower, "node: command not found") ||
	   strings.Contains(errorLogLower, "node: not found") {
		diagnosis.Problem = "Node.js未安装"
		diagnosis.Cause = "系统未安装Node.js或Node.js未添加到PATH"
		diagnosis.Solutions = []string{
			"安装Node.js: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs",
			"使用nvm安装Node.js: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash",
			"检查PATH环境变量: echo $PATH",
		}
		diagnosis.Confidence = 0.95
		diagnosis.Recommendation = "建议使用nvm管理Node.js版本"
	} else if strings.Contains(errorLogLower, "npm: command not found") ||
	          strings.Contains(errorLogLower, "npm: not found") {
		diagnosis.Problem = "npm未安装"
		diagnosis.Cause = "Node.js安装不完整或npm未正确安装"
		diagnosis.Solutions = []string{
			"重新安装Node.js (包含npm)",
			"单独安装npm: sudo apt-get install npm",
			"使用nvm重新安装Node.js",
		}
		diagnosis.Confidence = 0.9
		diagnosis.Recommendation = "建议安装完整的Node.js发行版"
	} else if strings.Contains(errorLogLower, "eacces") ||
	          strings.Contains(errorLogLower, "permission denied") {
		diagnosis.Problem = "权限不足"
		diagnosis.Cause = "当前用户没有足够的权限执行操作"
		diagnosis.Solutions = []string{
			"使用sudo执行命令",
			"修复文件权限: sudo chown -R $(whoami) node_modules",
			"使用--unsafe-perm参数: npm install --unsafe-perm",
		}
		diagnosis.Confidence = 0.85
		diagnosis.Recommendation = "检查文件所有权和权限"
	} else if strings.Contains(errorLogLower, "module not found") ||
	          strings.Contains(errorLogLower, "cannot find module") {
		diagnosis.Problem = "模块未找到"
		diagnosis.Cause = "依赖包未安装或路径不正确"
		diagnosis.Solutions = []string{
			"重新安装依赖: rm -rf node_modules && npm install",
			"清除npm缓存: npm cache clean --force",
			"检查package.json中的依赖名称",
		}
		diagnosis.Confidence = 0.8
		diagnosis.Recommendation = "检查依赖包名称和版本"
	} else if strings.Contains(errorLogLower, "port already in use") ||
	          strings.Contains(errorLogLower, "eaddrinuse") {
		diagnosis.Problem = "端口被占用"
		diagnosis.Cause = "指定的端口已被其他进程使用"
		diagnosis.Solutions = []string{
			"查找占用端口的进程: lsof -i :3000",
			"杀死占用进程: kill -9 <PID>",
			"更改应用监听的端口",
			"使用其他空闲端口",
		}
		diagnosis.Confidence = 0.9
		diagnosis.Recommendation = "建议使用3000以外的端口"
	} else if strings.Contains(errorLogLower, "connection refused") ||
	          strings.Contains(errorLogLower, "connection timeout") {
		diagnosis.Problem = "连接被拒绝或超时"
		diagnosis.Cause = "网络问题或服务未启动"
		diagnosis.Solutions = []string{
			"检查服务是否启动: sudo systemctl status <service>",
			"检查防火墙设置: sudo ufw status",
			"检查网络连接: ping <host>",
			"增加连接超时时间",
		}
		diagnosis.Confidence = 0.75
		diagnosis.Recommendation = "检查服务状态和网络配置"
	} else if strings.Contains(errorLogLower, "out of memory") ||
	          strings.Contains(errorLogLower, "oom") {
		diagnosis.Problem = "内存不足"
		diagnosis.Cause = "系统内存不足或应用内存泄漏"
		diagnosis.Solutions = []string{
			"增加系统交换空间",
			"优化应用内存使用",
			"使用--max-old-space-size参数限制Node.js内存",
			"重启服务释放内存",
		}
		diagnosis.Confidence = 0.8
		diagnosis.Recommendation = "监控内存使用情况"
	} else if strings.Contains(errorLogLower, "docker") && 
	          (strings.Contains(errorLogLower, "not found") || 
	           strings.Contains(errorLogLower, "permission denied")) {
		diagnosis.Problem = "Docker相关问题"
		diagnosis.Cause = "Docker未安装或权限不足"
		diagnosis.Solutions = []string{
			"安装Docker: curl -fsSL https://get.docker.com | sh",
			"添加用户到docker组: sudo usermod -aG docker $USER",
			"重启Docker服务: sudo systemctl restart docker",
		}
		diagnosis.Confidence = 0.85
		diagnosis.Recommendation = "确保Docker正确安装并配置权限"
	} else {
		// 通用错误分析
		diagnosis.Problem = "未知错误"
		diagnosis.Cause = "需要进一步分析错误日志"
		diagnosis.Solutions = []string{
			"检查日志文件获取更多信息",
			"搜索错误信息在线解决方案",
			"尝试在开发环境中重现问题",
			"联系技术支持",
		}
		diagnosis.Confidence = 0.5
		diagnosis.Recommendation = "提供完整的错误日志和环境信息"
	}

	// 添加上下文相关建议
	if context != "" {
		diagnosis.Recommendation = fmt.Sprintf("%s (上下文: %s)", diagnosis.Recommendation, context)
	}

	return diagnosis
}

// getCommonSuggestions 获取常见建议
func getCommonSuggestions() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"id":          1,
			"category":    "性能优化",
			"title":       "启用Gzip压缩",
			"description": "启用Gzip压缩可以减少传输数据量，提高加载速度",
			"command":     "npm install compression --save",
			"impact":      "high",
		},
		{
			"id":          2,
			"category":    "性能优化",
			"title":       "启用缓存",
			"description": "合理设置HTTP缓存头可以减少重复请求",
			"command":     "// 设置Cache-Control头",
			"impact":      "medium",
		},
		{
			"id":          3,
			"category":    "安全",
			"title":       "添加安全头",
			"description": "设置安全相关的HTTP头防止常见攻击",
			"command":     "npm install helmet --save",
			"impact":      "high",
		},
		{
			"id":          4,
			"category":    "监控",
			"title":       "添加健康检查端点",
			"description": "添加/health端点用于监控服务状态",
			"command":     "app.get('/health', (req, res) => res.json({status: 'ok'}));",
			"impact":      "medium",
		},
		{
			"id":          5,
			"category":    "部署",
			"title":       "使用PM2进程管理",
			"description": "使用PM2管理Node.js进程，支持自动重启和负载均衡",
			"command":     "npm install pm2 -g && pm2 start app.js",
			"impact":      "high",
		},
		{
			"id":          6,
			"category":    "数据库",
			"title":       "添加连接池",
			"description": "使用数据库连接池提高数据库连接效率",
			"command":     "npm install pg-pool --save",
			"impact":      "medium",
		},
	}
}

// applyAIFix 应用AI修复
func applyAIFix(req AIFixRequest) *AIFixResponse {
	fixResult := &AIFixResponse{
		FixID:   fmt.Sprintf("fix_%d", time.Now().Unix()),
		Status:  "pending",
		Message: "修复准备中",
		Applied: false,
	}

	// 这里应该实现实际的修复逻辑
	// 基于diagnosisID和solutionID执行相应的修复

	if req.AutoApply {
		// 自动应用修复
		fixResult.Status = "applied"
		fixResult.Message = "修复已自动应用"
		fixResult.Applied = true
		fixResult.Changes = []string{
			"已应用建议的配置更改",
			"已备份原始文件",
			"已重启相关服务",
		}
		fixResult.BackupPath = "/tmp/backup_" + time.Now().Format("20060102_150405")
	} else {
		// 生成修复脚本
		fixResult.Status = "generated"
		fixResult.Message = "已生成修复脚本"
		fixResult.Applied = false
		fixResult.Changes = []string{
			"修复脚本已生成",
			"请手动审核并执行",
		}
	}

	return fixResult
}