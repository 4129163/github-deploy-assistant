package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github-deploy-assistant-backend/models"
)

// GitHubIssueTemplate GitHub Issue模板
type GitHubIssueTemplate struct {
	Title     string   `json:"title"`
	Body      string   `json:"body"`
	Labels    []string `json:"labels"`
	Assignees []string `json:"assignees"`
}

// CreateGitHubIssue 创建GitHub Issue
func CreateGitHubIssue(issueReq models.CreateIssueRequest, issueID string) (string, error) {
	// 从环境变量获取GitHub配置
	githubToken := os.Getenv("GITHUB_TOKEN")
	githubRepo := os.Getenv("GITHUB_REPO")

	if githubToken == "" || githubRepo == "" {
		log.Println("GitHub配置未设置，跳过创建GitHub Issue")
		return "", fmt.Errorf("GitHub配置未设置")
	}

	// 解析环境信息
	var envInfo map[string]interface{}
	if issueReq.Environment != "" {
		if err := json.Unmarshal([]byte(issueReq.Environment), &envInfo); err != nil {
			log.Printf("解析环境信息失败: %v", err)
			envInfo = make(map[string]interface{})
		}
	}

	// 构建Issue Body
	body := buildIssueBody(issueReq, issueID, envInfo)

	// 创建Issue请求
	issueTemplate := GitHubIssueTemplate{
		Title:  fmt.Sprintf("[GDA] %s", issueReq.Title),
		Body:   body,
		Labels: getLabelsForIssue(issueReq.IssueType, issueReq.Priority),
	}

	// 发送请求到GitHub API
	url := fmt.Sprintf("https://api.github.com/repos/%s/issues", githubRepo)
	jsonData, err := json.Marshal(issueTemplate)
	if err != nil {
		return "", fmt.Errorf("序列化Issue数据失败: %v", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("创建HTTP请求失败: %v", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("token %s", githubToken))
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("发送GitHub请求失败: %v", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 201 {
		log.Printf("GitHub API响应错误: %s", string(bodyBytes))
		return "", fmt.Errorf("GitHub API返回错误状态码: %d", resp.StatusCode)
	}

	// 解析响应
	var issueResponse struct {
		HTMLURL string `json:"html_url"`
		Number  int    `json:"number"`
	}
	if err := json.Unmarshal(bodyBytes, &issueResponse); err != nil {
		return "", fmt.Errorf("解析GitHub响应失败: %v", err)
	}

	log.Printf("GitHub Issue创建成功: #%d - %s", issueResponse.Number, issueResponse.HTMLURL)
	return issueResponse.HTMLURL, nil
}

// SyncGitHubIssues 同步GitHub Issues到本地数据库
func SyncGitHubIssues(projectID string) error {
	githubToken := os.Getenv("GITHUB_TOKEN")
	githubRepo := os.Getenv("GITHUB_REPO")

	if githubToken == "" || githubRepo == "" {
		return fmt.Errorf("GitHub配置未设置")
	}

	// 获取GitHub Issues
	url := fmt.Sprintf("https://api.github.com/repos/%s/issues?state=all", githubRepo)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("创建HTTP请求失败: %v", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("token %s", githubToken))
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("发送GitHub请求失败: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("GitHub API返回错误状态码: %d", resp.StatusCode)
	}

	bodyBytes, _ := io.ReadAll(resp.Body)

	var githubIssues []struct {
		ID        int    `json:"id"`
		Number    int    `json:"number"`
		Title     string `json:"title"`
		Body      string `json:"body"`
		State     string `json:"state"`
		HTMLURL   string `json:"html_url"`
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
		Labels    []struct {
			Name string `json:"name"`
		} `json:"labels"`
		User struct {
			Login string `json:"login"`
		} `json:"user"`
	}

	if err := json.Unmarshal(bodyBytes, &githubIssues); err != nil {
		return fmt.Errorf("解析GitHub Issues失败: %v", err)
	}

	// 同步到本地数据库
	db := GetDB()
	for _, gi := range githubIssues {
		// 检查是否已存在
		var existingID string
		err := db.QueryRow("SELECT id FROM issues WHERE github_issue_url = ?", gi.HTMLURL).Scan(&existingID)
		
		if err == nil {
			// 更新现有记录
			state := "open"
			if gi.State == "closed" {
				state = "closed"
			}
			
			// 从标签中提取类型和优先级
			issueType, priority := extractTypeAndPriority(gi.Labels)
			
			_, err = db.Exec(`
				UPDATE issues SET 
					title = ?, 
					description = ?, 
					status = ?, 
					issue_type = ?, 
					priority = ?,
					updated_at = ?
				WHERE github_issue_url = ?
			`, gi.Title, gi.Body, state, issueType, priority, time.Now(), gi.HTMLURL)
			
			if err != nil {
				log.Printf("更新Issue失败: %v", err)
			}
		} else if err == sql.ErrNoRows {
			// 创建新记录
			issueID := uuid.New().String()
			state := "open"
			if gi.State == "closed" {
				state = "closed"
			}
			
			issueType, priority := extractTypeAndPriority(gi.Labels)
			
			createdAt, _ := time.Parse(time.RFC3339, gi.CreatedAt)
			updatedAt, _ := time.Parse(time.RFC3339, gi.UpdatedAt)
			
			_, err = db.Exec(`
				INSERT INTO issues (id, project_id, user_name, user_email, title, description, issue_type, status, priority, github_issue_url, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, issueID, projectID, gi.User.Login, "", gi.Title, gi.Body, issueType, state, priority, gi.HTMLURL, createdAt, updatedAt)
			
			if err != nil {
				log.Printf("插入Issue失败: %v", err)
			}
		}
	}

	log.Printf("同步完成，处理了 %d 个GitHub Issues", len(githubIssues))
	return nil
}

// Helper functions

func buildIssueBody(issueReq models.CreateIssueRequest, issueID string, envInfo map[string]interface{}) string {
	var body strings.Builder
	
	body.WriteString(fmt.Sprintf("## 问题报告\n\n"))
	body.WriteString(fmt.Sprintf("**报告ID**: %s\n", issueID))
	body.WriteString(fmt.Sprintf("**报告时间**: %s\n", time.Now().Format("2006-01-02 15:04:05")))
	body.WriteString(fmt.Sprintf("**报告人**: %s (%s)\n\n", issueReq.UserName, issueReq.UserEmail))
	
	body.WriteString(fmt.Sprintf("### 问题描述\n%s\n\n", issueReq.Description))
	
	body.WriteString(fmt.Sprintf("### 问题类型\n%s\n\n", issueReq.IssueType))
	
	body.WriteString(fmt.Sprintf("### 优先级\n%s\n\n", issueReq.Priority))
	
	if len(envInfo) > 0 {
		body.WriteString("### 环境信息\n")
		for key, value := range envInfo {
			body.WriteString(fmt.Sprintf("- **%s**: %v\n", key, value))
		}
		body.WriteString("\n")
	}
	
	body.WriteString("---\n")
	body.WriteString("*此Issue由GitHub Deploy Assistant自动生成*\n")
	
	return body.String()
}

func getLabelsForIssue(issueType, priority string) []string {
	labels := []string{"gda-auto-generated"}
	
	// 添加类型标签
	switch strings.ToLower(issueType) {
	case "bug":
		labels = append(labels, "bug")
	case "feature_request":
		labels = append(labels, "enhancement")
	case "question":
		labels = append(labels, "question")
	default:
		labels = append(labels, "triage")
	}
	
	// 添加优先级标签
	switch strings.ToLower(priority) {
	case "critical":
		labels = append(labels, "priority-critical")
	case "high":
		labels = append(labels, "priority-high")
	case "medium":
		labels = append(labels, "priority-medium")
	case "low":
		labels = append(labels, "priority-low")
	}
	
	return labels
}

func extractTypeAndPriority(labels []struct{ Name string }) (string, string) {
	issueType := "bug"
	priority := "medium"
	
	for _, label := range labels {
		labelName := strings.ToLower(label.Name)
		
		switch labelName {
		case "bug":
			issueType = "bug"
		case "enhancement", "feature":
			issueType = "feature_request"
		case "question":
			issueType = "question"
		case "priority-critical":
			priority = "critical"
		case "priority-high":
			priority = "high"
		case "priority-medium":
			priority = "medium"
		case "priority-low":
			priority = "low"
		}
	}
	
	return issueType, priority
}