module github-deploy-assistant-backend

go 1.21

// 由于网络问题，我们使用最小化依赖
// 在实际部署时，应该使用 go get 下载依赖

// 我们创建一个简单的 HTTP 服务器，不使用外部依赖