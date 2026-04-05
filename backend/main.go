package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	
	"github-deploy-assistant-backend/handlers"
	"github-deploy-assistant-backend/routes"
)

func main() {
	// 初始化数据库
	if err := InitDatabase(); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	defer CloseDatabase()

	// 初始化数据
	handlers.InitializeData()

	// 创建路由器
	router := mux.NewRouter()

	// 设置路由
	routes.SetupAllRoutes(router)

	// 配置 CORS
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}).Handler(router)

	// 设置静态文件服务
	fs := http.FileServer(http.Dir("../public"))
	router.PathPrefix("/").Handler(fs)

	// 服务器配置
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      corsHandler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 优雅关闭
	go func() {
		sigint := make(chan os.Signal, 1)
		signal.Notify(sigint, os.Interrupt, syscall.SIGTERM)
		<-sigint

		log.Println("正在关闭服务器...")
		if err := server.Shutdown(nil); err != nil {
			log.Printf("服务器关闭错误: %v", err)
		}
	}()

	log.Printf("服务器启动在 http://localhost:%s", port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("服务器启动失败: %v", err)
	}
}