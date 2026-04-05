package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

// InitDatabase 初始化SQLite数据库
func InitDatabase() error {
	// 确保数据目录存在
	dataDir := "./data"
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return fmt.Errorf("创建数据目录失败: %v", err)
	}

	// 连接数据库
	dbPath := filepath.Join(dataDir, "gda.db")
	var err error
	db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return fmt.Errorf("连接数据库失败: %v", err)
	}

	// 测试连接
	if err := db.Ping(); err != nil {
		return fmt.Errorf("数据库连接测试失败: %v", err)
	}

	// 创建表
	if err := createTables(); err != nil {
		return fmt.Errorf("创建表失败: %v", err)
	}

	log.Printf("数据库初始化成功: %s", dbPath)
	return nil
}

// createTables 创建所有需要的表
func createTables() error {
	// 创建项目表
	projectsTable := `
	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		port INTEGER NOT NULL,
		path TEXT NOT NULL,
		status TEXT NOT NULL,
		last_active DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		deployment_count INTEGER DEFAULT 0
	);
	`

	// 创建评论表
	commentsTable := `
	CREATE TABLE IF NOT EXISTS comments (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		user_id TEXT,
		user_name TEXT NOT NULL,
		user_email TEXT NOT NULL,
		content TEXT NOT NULL,
		rating REAL CHECK (rating >= 0 AND rating <= 5),
		helpful INTEGER DEFAULT 0,
		not_helpful INTEGER DEFAULT 0,
		is_verified BOOLEAN DEFAULT FALSE,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	);
	`

	// 创建问题报告表
	issuesTable := `
	CREATE TABLE IF NOT EXISTS issues (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		user_id TEXT,
		user_name TEXT NOT NULL,
		user_email TEXT NOT NULL,
		title TEXT NOT NULL,
		description TEXT NOT NULL,
		issue_type TEXT NOT NULL,
		status TEXT DEFAULT 'open',
		priority TEXT DEFAULT 'medium',
		environment TEXT,
		github_issue_url TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		resolved_at DATETIME,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	);
	`

	// 创建投票表（防止重复投票）
	votesTable := `
	CREATE TABLE IF NOT EXISTS comment_votes (
		id TEXT PRIMARY KEY,
		comment_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		is_helpful BOOLEAN,
		voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(comment_id, user_id),
		FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
	);
	`

	// 创建索引
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id);",
		"CREATE INDEX IF NOT EXISTS idx_comments_rating ON comments(rating);",
		"CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);",
		"CREATE INDEX IF NOT EXISTS idx_issues_project_id ON issues(project_id);",
		"CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);",
		"CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);",
		"CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);",
	}

	// 执行所有SQL语句
	tables := []string{projectsTable, commentsTable, issuesTable, votesTable}
	tables = append(tables, indexes...)

	for _, sql := range tables {
		if _, err := db.Exec(sql); err != nil {
			return fmt.Errorf("执行SQL失败: %s, 错误: %v", sql, err)
		}
	}

	return nil
}

// GetDB 获取数据库连接
func GetDB() *sql.DB {
	return db
}

// CloseDatabase 关闭数据库连接
func CloseDatabase() {
	if db != nil {
		db.Close()
	}
}