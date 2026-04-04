# GitHub Deploy Assistant Go 后端 Makefile

.PHONY: all build clean test linux windows macos cross-build release install

# 默认目标
all: build

# 构建当前平台
build:
	@echo "构建 GitHub Deploy Assistant Go 后端..."
	go build -ldflags="-s -w" -o dist/github-deploy-assistant-$(shell go env GOOS)-$(shell go env GOARCH) simple_main.go
	@echo "构建完成: dist/github-deploy-assistant-$(shell go env GOOS)-$(shell go env GOARCH)"

# 清理
clean:
	@echo "清理构建文件..."
	rm -rf dist/
	rm -f github-deploy-assistant-go gda-server

# 测试
test:
	@echo "运行测试..."
	go run test_validation.go

# Linux 构建
linux:
	@echo "构建 Linux 版本..."
	GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o dist/github-deploy-assistant-linux-amd64 simple_main.go
	GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o dist/github-deploy-assistant-linux-arm64 simple_main.go
	@echo "Linux 构建完成"

# Windows 构建
windows:
	@echo "构建 Windows 版本..."
	GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o dist/github-deploy-assistant-windows-amd64.exe simple_main.go
	GOOS=windows GOARCH=386 go build -ldflags="-s -w" -o dist/github-deploy-assistant-windows-386.exe simple_main.go
	@echo "Windows 构建完成"

# macOS 构建
macos:
	@echo "构建 macOS 版本..."
	GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o dist/github-deploy-assistant-darwin-amd64 simple_main.go
	GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o dist/github-deploy-assistant-darwin-arm64 simple_main.go
	@echo "macOS 构建完成"

# 跨平台构建
cross-build: linux windows macos
	@echo "所有平台构建完成"
	@echo "文件列表:"
	@ls -lh dist/

# 发布版本
release: clean cross-build
	@echo "创建发布包..."
	@mkdir -p release
	# Linux
	cd dist && tar czf ../release/github-deploy-assistant-linux-amd64.tar.gz github-deploy-assistant-linux-amd64
	cd dist && tar czf ../release/github-deploy-assistant-linux-arm64.tar.gz github-deploy-assistant-linux-arm64
	# Windows
	cd dist && zip ../release/github-deploy-assistant-windows-amd64.zip github-deploy-assistant-windows-amd64.exe
	cd dist && zip ../release/github-deploy-assistant-windows-386.zip github-deploy-assistant-windows-386.exe
	# macOS
	cd dist && tar czf ../release/github-deploy-assistant-darwin-amd64.tar.gz github-deploy-assistant-darwin-amd64
	cd dist && tar czf ../release/github-deploy-assistant-darwin-arm64.tar.gz github-deploy-assistant-darwin-arm64
	
	@echo "发布包创建完成:"
	@ls -lh release/
	@echo ""
	@echo "各平台文件大小:"
	@echo "Linux amd64:   $$(stat -c%s dist/github-deploy-assistant-linux-amd64 | numfmt --to=iec)"
	@echo "Linux arm64:   $$(stat -c%s dist/github-deploy-assistant-linux-arm64 | numfmt --to=iec)"
	@echo "Windows amd64: $$(stat -c%s dist/github-deploy-assistant-windows-amd64.exe | numfmt --to=iec)"
	@echo "macOS amd64:   $$(stat -c%s dist/github-deploy-assistant-darwin-amd64 | numfmt --to=iec)"
	@echo "macOS arm64:   $$(stat -c%s dist/github-deploy-assistant-darwin-arm64 | numfmt --to=iec)"

# 安装到系统路径
install:
	@echo "安装到 /usr/local/bin..."
	sudo cp dist/github-deploy-assistant-$(shell go env GOOS)-$(shell go env GOARCH) /usr/local/bin/github-deploy-assistant
	sudo chmod +x /usr/local/bin/github-deploy-assistant
	@echo "安装完成"

# 帮助信息
help:
	@echo "可用命令:"
	@echo "  make build       构建当前平台"
	@echo "  make clean       清理构建文件"
	@echo "  make test        运行测试"
	@echo "  make linux       构建 Linux 版本"
	@echo "  make windows     构建 Windows 版本"
	@echo "  make macos       构建 macOS 版本"
	@echo "  make cross-build 构建所有平台"
	@echo "  make release     创建发布包"
	@echo "  make install     安装到系统路径"
	@echo "  make help        显示帮助信息"