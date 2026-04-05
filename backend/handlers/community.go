package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/google/uuid"

	"github-deploy-assistant-backend/models"
)

// CreateComment 创建评论
func CreateComment(w http.ResponseWriter, r *http.Request) {
	var req models.CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "无效的请求数据")
		return
	}

	// 验证输入
	if req.ProjectID == "" {
		respondWithError(w, http.StatusBadRequest, "项目ID不能为空")
		return
	}
	if req.UserName == "" {
		respondWithError(w, http.StatusBadRequest, "用户名不能为空")
		return
	}
	if req.Content == "" {
		respondWithError(w, http.StatusBadRequest, "评论内容不能为空")
		return
	}
	if req.Rating < 0 || req.Rating > 5 {
		respondWithError(w, http.StatusBadRequest, "评分必须在0-5之间")
		return
	}

	// 生成ID
	commentID := uuid.New().String()
	now := time.Now()

	// 检查用户是否已验证（已部署过项目）
	isVerified := checkUserVerification(req.UserEmail, req.ProjectID)

	// 插入数据库
	db := GetDB()
	query := `
		INSERT INTO comments (id, project_id, user_name, user_email, content, rating, is_verified, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := db.Exec(query,
		commentID,
		req.ProjectID,
		req.UserName,
		req.UserEmail,
		req.Content,
		req.Rating,
		isVerified,
		now,
		now,
	)

	if err != nil {
		log.Printf("创建评论失败: %v", err)
		respondWithError(w, http.StatusInternalServerError, "创建评论失败")
		return
	}

	// 更新项目统计信息
	updateProjectStats(req.ProjectID)

	comment := models.Comment{
		ID:         commentID,
		ProjectID:  req.ProjectID,
		UserName:   req.UserName,
		UserEmail:  req.UserEmail,
		Content:    req.Content,
		Rating:     req.Rating,
		Helpful:    0,
		NotHelpful: 0,
		IsVerified: isVerified,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	respondWithJSON(w, http.StatusCreated, models.APIResponse{
		Success: true,
		Data:    comment,
	})
}

// GetProjectComments 获取项目评论
func GetProjectComments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectId"]

	if projectID == "" {
		respondWithError(w, http.StatusBadRequest, "项目ID不能为空")
		return
	}

	// 获取查询参数
	sortBy := r.URL.Query().Get("sort")
	limit := r.URL.Query().Get("limit")
	offset := r.URL.Query().Get("offset")

	// 构建SQL查询
	query := "SELECT id, project_id, user_name, user_email, content, rating, helpful, not_helpful, is_verified, created_at, updated_at FROM comments WHERE project_id = ?"
	
	// 添加排序
	switch sortBy {
	case "rating":
		query += " ORDER BY rating DESC"
	case "helpful":
		query += " ORDER BY helpful DESC"
	case "recent":
		query += " ORDER BY created_at DESC"
	default:
		query += " ORDER BY created_at DESC"
	}

	// 添加分页
	if limit != "" {
		query += " LIMIT " + limit
		if offset != "" {
			query += " OFFSET " + offset
		}
	}

	db := GetDB()
	rows, err := db.Query(query, projectID)
	if err != nil {
		log.Printf("查询评论失败: %v", err)
		respondWithError(w, http.StatusInternalServerError, "获取评论失败")
		return
	}
	defer rows.Close()

	var comments []models.Comment
	for rows.Next() {
		var comment models.Comment
		err := rows.Scan(
			&comment.ID,
			&comment.ProjectID,
			&comment.UserName,
			&comment.UserEmail,
			&comment.Content,
			&comment.Rating,
			&comment.Helpful,
			&comment.NotHelpful,
			&comment.IsVerified,
			&comment.CreatedAt,
			&comment.UpdatedAt,
		)
		if err != nil {
			log.Printf("扫描评论数据失败: %v", err)
			continue
		}
		comments = append(comments, comment)
	}

	// 获取项目统计信息
	stats, _ := getProjectStats(projectID)

	response := map[string]interface{}{
		"comments": comments,
		"stats":    stats,
		"total":    len(comments),
	}

	respondWithJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// VoteComment 投票评论
func VoteComment(w http.ResponseWriter, r *http.Request) {
	var req models.VoteCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "无效的请求数据")
		return
	}

	if req.CommentID == "" {
		respondWithError(w, http.StatusBadRequest, "评论ID不能为空")
		return
	}

	// 获取用户ID（从请求头或cookie）
	userID := getUserID(r)
	if userID == "" {
		respondWithError(w, http.StatusUnauthorized, "需要用户认证")
		return
	}

	db := GetDB()

	// 检查是否已经投票过
	var existingVoteID string
	var existingHelpful *bool
	err := db.QueryRow("SELECT id, is_helpful FROM comment_votes WHERE comment_id = ? AND user_id = ?", req.CommentID, userID).
		Scan(&existingVoteID, &existingHelpful)

	if err == nil {
		// 已经投过票，更新投票
		if existingHelpful != nil && *existingHelpful == req.Helpful {
			// 相同投票，取消投票
			_, err = db.Exec("DELETE FROM comment_votes WHERE id = ?", existingVoteID)
			if err != nil {
				log.Printf("删除投票失败: %v", err)
				respondWithError(w, http.StatusInternalServerError, "更新投票失败")
				return
			}
			
			// 更新评论投票数
			updateField := "helpful"
			if !req.Helpful {
				updateField = "not_helpful"
			}
			_, err = db.Exec(fmt.Sprintf("UPDATE comments SET %s = %s - 1 WHERE id = ?", updateField, updateField), req.CommentID)
		} else {
			// 不同投票，更新投票
			_, err = db.Exec("UPDATE comment_votes SET is_helpful = ?, voted_at = CURRENT_TIMESTAMP WHERE id = ?", req.Helpful, existingVoteID)
			if err != nil {
				log.Printf("更新投票失败: %v", err)
				respondWithError(w, http.StatusInternalServerError, "更新投票失败")
				return
			}
			
			// 更新评论投票数
			if existingHelpful != nil {
				oldField := "helpful"
				if !*existingHelpful {
					oldField = "not_helpful"
				}
				_, err = db.Exec(fmt.Sprintf("UPDATE comments SET %s = %s - 1 WHERE id = ?", oldField, oldField), req.CommentID)
			}
			
			newField := "helpful"
			if !req.Helpful {
				newField = "not_helpful"
			}
			_, err = db.Exec(fmt.Sprintf("UPDATE comments SET %s = %s + 1 WHERE id = ?", newField, newField), req.CommentID)
		}
	} else if err == sql.ErrNoRows {
		// 新投票
		voteID := uuid.New().String()
		_, err = db.Exec("INSERT INTO comment_votes (id, comment_id, user_id, is_helpful) VALUES (?, ?, ?, ?)",
			voteID, req.CommentID, userID, req.Helpful)
		if err != nil {
			log.Printf("插入投票失败: %v", err)
			respondWithError(w, http.StatusInternalServerError, "投票失败")
			return
		}
		
		// 更新评论投票数
		updateField := "helpful"
		if !req.Helpful {
			updateField = "not_helpful"
		}
		_, err = db.Exec(fmt.Sprintf("UPDATE comments SET %s = %s + 1 WHERE id = ?", updateField, updateField), req.CommentID)
	} else {
		log.Printf("查询投票失败: %v", err)
		respondWithError(w, http.StatusInternalServerError, "投票失败")
		return
	}

	if err != nil {
		log.Printf("更新评论投票数失败: %v", err)
		respondWithError(w, http.StatusInternalServerError, "更新投票失败")
		return
	}

	respondWithJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data:    "投票成功",
	})
}

// CreateIssue 创建问题报告
func CreateIssue(w http.ResponseWriter, r *http.Request) {
	var req models.CreateIssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "无效的请求数据")
		return
	}

	// 验证输入
	if req.ProjectID == "" {
		respondWithError(w, http.StatusBadRequest, "项目ID不能为空")
		return
	}
	if req.Title == "" {
		respondWithError(w, http.StatusBadRequest, "问题标题不能为空")
		return
	}
	if req.Description == "" {
		respondWithError(w, http.StatusBadRequest, "问题描述不能为空")
		return
	}

	// 生成ID
	issueID := uuid.New().String()
	now := time.Now()

	// 插入数据库
	db := GetDB()
	query := `
		INSERT INTO issues (id, project_id, user_name, user_email, title, description, issue_type, priority, environment, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := db.Exec(query,
		issueID,
		req.ProjectID,
		req.UserName,
		req.UserEmail,
		req.Title,
		req.Description,
		req.IssueType,
		req.Priority,
		req.Environment,
		now,
		now,
	)

	if err != nil {
		log.Printf("创建问题报告失败: %v", err)
		respondWithError(w, http.StatusInternalServerError, "创建问题报告失败")
		return
	}

	// 尝试创建GitHub Issue
	githubURL, err := CreateGitHubIssue(req, issueID)
	if err != nil {
		log.Printf("创建GitHub Issue失败: %v", err)
	} else if githubURL != "" {
		_, err = db.Exec("UPDATE issues SET github_issue_url = ? WHERE id = ?", githubURL, issueID)
		if err != nil {
			log.Printf("更新GitHub Issue链接失败: %v", err)
		}
	}

	issue := models.IssueReport{
		ID:             issueID,
		ProjectID:      req.ProjectID,
		UserName:       req.UserName,
		UserEmail:      req.UserEmail,
		Title:          req.Title,
		Description:    req.Description,
		IssueType:      req.IssueType,
		Status:         "open",
		Priority:       req.Priority,
		Environment:    req.Environment,
		GitHubIssueURL: githubURL,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	respondWithJSON(w, http.StatusCreated, models.APIResponse{
		Success: true,
		Data:    issue,
	})
}

// GetProjectIssues 获取项目问题
func GetProjectIssues(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectId"]

	if projectID == "" {
		respondWithError(w, http.StatusBadRequest, "项目ID不能为空")
		return
	}

	// 获取查询参数
	status := r.URL.Query().Get("status")
	priority := r.URL.Query().Get("priority")
	issueType := r.URL.Query().Get("type")

	// 构建SQL查询
	query := "SELECT id, project_id, user_name, user_email, title, description, issue_type, status, priority, environment, github_issue_url, created_at, updated_at, resolved_at FROM issues WHERE project_id = ?"
	var params []interface{}
	params = append(params, projectID)

	if status != "" {
		query += " AND status = ?"
		params = append(params, status)
	}
	if priority != "" {
		query += " AND priority = ?"
		params = append(params, priority)
	}
	if issueType != "" {
		query += " AND issue_type = ?"
		params = append(params, issueType)
	}

	query += " ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END, created_at DESC"

	db := GetDB()
	rows, err := db.Query(query, params...)
	if err != nil {
		log.Printf("查询问题失败: %v", err)
		respondWithError(w, http.StatusInternalServerError, "获取问题失败")
		return
	}
	defer rows.Close()

	var issues []models.IssueReport
	for rows.Next() {
		var issue models.IssueReport
		var resolvedAt sql.NullTime
		err := rows.Scan(
			&issue.ID,
			&issue.ProjectID,
			&issue.UserName,
			&issue.UserEmail,
			&issue.Title,
			&issue.Description,
			&issue.IssueType,
			&issue.Status,
			&issue.Priority,
			&issue.Environment,
			&issue.GitHubIssueURL,
			&issue.CreatedAt,
			&issue.UpdatedAt,
			&resolvedAt,
		)
		if err != nil {
			log.Printf("扫描问题数据失败: %v", err)
			continue
		}
		if resolvedAt.Valid {
			issue.ResolvedAt = &resolvedAt.Time
		}
		issues = append(issues, issue)
	}

	respondWithJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data:    issues,
	})
}

// Helper functions

func checkUserVerification(userEmail, projectID string) bool {
	db := GetDB()
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM projects WHERE id = ?", projectID).Scan(&count)
	if err != nil {
		return false
	}
	// 这里可以添加更复杂的验证逻辑
	// 例如检查用户是否部署过该项目
	return count > 0
}

func updateProjectStats(projectID string) {
	db := GetDB()
	
	// 更新评论数和平均评分
	_, err := db.Exec(`
		UPDATE projects 
		SET deployment_count = (
			SELECT COUNT(*) FROM comments WHERE project_id = ?
		)
		WHERE id = ?
	`, projectID, projectID)
	
	if err != nil {
		log.Printf("更新项目统计失败: %v", err)
	}
}

func getProjectStats(projectID string) (*models.ProjectStats, error) {
	db := GetDB()
	var stats models.ProjectStats
	stats.ProjectID = projectID

	// 获取评论统计
	err := db.QueryRow(`
		SELECT 
			COUNT(*) as total_comments,
			COALESCE(AVG(rating), 0) as average_rating,
			COUNT(rating) as total_ratings
		FROM comments 
		WHERE project_id = ?
	`, projectID).Scan(&stats.TotalComments, &stats.AverageRating, &stats.TotalRatings)

	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// 获取问题统计
	err = db.QueryRow(`
		SELECT 
			COUNT(*) as total_issues,
			SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_issues,
			SUM(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) as resolved_issues
		FROM issues 
		WHERE project_id = ?
	`, projectID).Scan(&stats.TotalIssues, &stats.OpenIssues, &stats.ResolvedIssues)

	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// 获取部署次数
	err = db.QueryRow("SELECT deployment_count FROM projects WHERE id = ?", projectID).
		Scan(&stats.DeploymentCount)

	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	return &stats, nil
}

func createGitHubIssue(req models.CreateIssueRequest, issueID string) string {
	// 这里实现GitHub Issue创建逻辑
	// 需要GitHub token和仓库信息
	// 暂时返回空字符串，表示未创建GitHub Issue
	return ""
}

func getUserID(r *http.Request) string {
	// 从认证信息中获取用户ID
	// 这里可以扩展为从JWT token、session等获取
	// 暂时返回空字符串
	return ""
}

func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, models.APIResponse{
		Success: false,
		Error:   message,
	})
}

func respondWithJSON(w http.ResponseWriter, code int, payload models.APIResponse) {
	response, _ := json.Marshal(payload)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}
// UpdateIssueStatus 更新问题状态
func UpdateIssueStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	issueID := vars["issueId"]

	if issueID == "" {
		respondWithError(w, http.StatusBadRequest, "问题ID不能为空")
		return
	}

	var req models.UpdateIssueStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "无效的请求数据")
		return
	}

	// 验证状态
	validStatuses := map[string]bool{
		"open":       true,
		"in_progress": true,
		"resolved":   true,
		"closed":     true,
	}
	if !validStatuses[req.Status] {
		respondWithError(w, http.StatusBadRequest, "无效的状态值")
		return
	}

	db := GetDB()
	now := time.Now()

	var resolvedAt interface{}
	if req.Status == "resolved" || req.Status == "closed" {
		resolvedAt = now
	} else {
		resolvedAt = nil
	}

	_, err := db.Exec(`
		UPDATE issues SET 
			status = ?, 
			resolved_at = ?, 
			updated_at = ?
		WHERE id = ?
	`, req.Status, resolvedAt, now, issueID)

	if err != nil {
		log.Printf("更新问题状态失败: %v", err)
		respondWithError(w, http.StatusInternalServerError, "更新问题状态失败")
		return
	}

	respondWithJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data:    "问题状态更新成功",
	})
}

// GetProjectStatsHandler 获取项目统计信息
func GetProjectStatsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectId"]

	if projectID == "" {
		respondWithError(w, http.StatusBadRequest, "项目ID不能为空")
		return
	}

	stats, err := getProjectStats(projectID)
	if err != nil {
		log.Printf("获取项目统计失败: %v", err)
		respondWithError(w, http.StatusInternalServerError, "获取统计信息失败")
		return
	}

	respondWithJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data:    stats,
	})
}

// SyncGitHubIssues 同步GitHub Issues
func SyncGitHubIssues(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectId"]

	if projectID == "" {
		respondWithError(w, http.StatusBadRequest, "项目ID不能为空")
		return
	}

	err := SyncGitHubIssues(projectID)
	if err != nil {
		log.Printf("同步GitHub Issues失败: %v", err)
		respondWithError(w, http.StatusInternalServerError, "同步GitHub Issues失败: "+err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data:    "GitHub Issues同步成功",
	})
}