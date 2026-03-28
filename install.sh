#!/bin/bash
# =============================================================================
# GitHub Deploy Assistant (GADA) - 一键安装脚本
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_header() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║              🚀 GitHub Deploy Assistant                       ║"
    echo "║                      一键安装脚本                              ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查系统要求
check_requirements() {
    print_info "检查系统环境..."
    
    # 检查 Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        print_success "Node.js 已安装: $NODE_VERSION"
    else
        print_error "未检测到 Node.js"
        print_info "请先安装 Node.js >= 18.0.0"
        print_info "安装指南: https://nodejs.org"
        exit 1
    fi
    
    # 检查 npm
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_success "npm 已安装: $NPM_VERSION"
    else
        print_error "未检测到 npm"
        exit 1
    fi
    
    # 检查 Git
    if command_exists git; then
        GIT_VERSION=$(git --version | cut -d' ' -f3)
        print_success "Git 已安装: $GIT_VERSION"
    else
        print_warning "未检测到 Git"
        print_info "建议安装 Git 以获得最佳体验"
    fi
    
    echo ""
}

# 选择安装目录
select_install_dir() {
    print_info "选择安装方式:"
    echo "1) 安装到当前目录 ($(pwd))"
    echo "2) 安装到用户目录 (~/.gada)"
    echo "3) 自定义目录"
    
    read -p "请选择 [1-3]: " choice
    
    case $choice in
        1)
            INSTALL_DIR="$(pwd)/github-deploy-assistant"
            ;;
        2)
            INSTALL_DIR="$HOME/.gada"
            ;;
        3)
            read -p "请输入安装目录: " custom_dir
            INSTALL_DIR="$custom_dir"
            ;;
        *)
            print_error "无效选择"
            exit 1
            ;;
    esac
    
    print_info "安装目录: $INSTALL_DIR"
}

# 下载并安装
install_gada() {
    print_info "开始下载..."
    
    # 创建安装目录
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # 克隆仓库
    if [ -d ".git" ]; then
        print_warning "目录已存在，执行更新..."
        git pull origin main
    else
        print_info "正在克隆仓库..."
        git clone https://github.com/4129163/github-deploy-assistant.git .
    fi
    
    print_success "代码下载完成"
    
    # 安装依赖
    print_info "安装依赖..."
    npm install
    print_success "依赖安装完成"
    
    # 创建 .env 文件
    if [ ! -f ".env" ]; then
        print_info "创建配置文件..."
        cp .env.example .env
        print_success "配置文件已创建"
    fi
    
    # 创建工作目录
    mkdir -p workspace logs database
    
    echo ""
}

# 配置 AI
configure_ai() {
    print_header
    print_info "🤖 配置 AI 模型（可选）"
    echo ""
    echo "GADA 支持以下 AI 模型:"
    echo "  • OpenAI (ChatGPT)"
    echo "  • DeepSeek"
    echo "  • Google Gemini"
    echo "  • Anthropic Claude"
    echo ""
    echo "如果你还没有 API Key，可以稍后在 .env 文件中配置"
    echo ""
    
    read -p "是否要现在配置 AI? (y/N): " configure_now
    
    if [[ $configure_now =~ ^[Yy]$ ]]; then
        echo ""
        print_info "请选择 AI 提供商:"
        echo "1) OpenAI"
        echo "2) DeepSeek"
        echo "3) Google Gemini"
        echo "4) Anthropic Claude"
        echo "5) 跳过"
        
        read -p "请选择 [1-5]: " ai_choice
        
        case $ai_choice in
            1)
                read -sp "请输入 OpenAI API Key (sk-...): " api_key
                echo ""
                sed -i "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$api_key|" .env
                sed -i "s|DEFAULT_AI_PROVIDER=.*|DEFAULT_AI_PROVIDER=openai|" .env
                print_success "OpenAI 配置完成"
                ;;
            2)
                read -sp "请输入 DeepSeek API Key: " api_key
                echo ""
                sed -i "s|DEEPSEEK_API_KEY=.*|DEEPSEEK_API_KEY=$api_key|" .env
                sed -i "s|DEFAULT_AI_PROVIDER=.*|DEFAULT_AI_PROVIDER=deepseek|" .env
                print_success "DeepSeek 配置完成"
                ;;
            3)
                read -sp "请输入 Gemini API Key: " api_key
                echo ""
                sed -i "s|GEMINI_API_KEY=.*|GEMINI_API_KEY=$api_key|" .env
                sed -i "s|DEFAULT_AI_PROVIDER=.*|DEFAULT_AI_PROVIDER=gemini|" .env
                print_success "Gemini 配置完成"
                ;;
            4)
                read -sp "请输入 Claude API Key: " api_key
                echo ""
                sed -i "s|CLAUDE_API_KEY=.*|CLAUDE_API_KEY=$api_key|" .env
                sed -i "s|DEFAULT_AI_PROVIDER=.*|DEFAULT_AI_PROVIDER=claude|" .env
                print_success "Claude 配置完成"
                ;;
            *)
                print_info "已跳过 AI 配置"
                ;;
        esac
    fi
    
    echo ""
}

# 创建启动脚本
create_launcher() {
    print_info "创建启动脚本..."
    
    # 创建 gada 命令
    cat > gada << 'EOF'
#!/bin/bash
GADA_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$GADA_DIR"
npm start
EOF
    chmod +x gada
    
    # 创建 CLI 启动脚本
    cat > gada-cli << 'EOF'
#!/bin/bash
GADA_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$GADA_DIR"
npm run cli
EOF
    chmod +x gada-cli
    
    print_success "启动脚本已创建"
}

# 添加到 PATH
add_to_path() {
    print_info "添加到系统 PATH（可选）"
    read -p "是否创建全局命令 gada? (y/N): " add_path
    
    if [[ $add_path =~ ^[Yy]$ ]]; then
        SHELL_RC=""
        if [ -n "$ZSH_VERSION" ]; then
            SHELL_RC="$HOME/.zshrc"
        elif [ -n "$BASH_VERSION" ]; then
            SHELL_RC="$HOME/.bashrc"
        fi
        
        if [ -n "$SHELL_RC" ]; then
            echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_RC"
            print_success "已添加到 $SHELL_RC"
            print_info "请运行: source $SHELL_RC"
        fi
    fi
    
    echo ""
}

# 完成信息
print_completion() {
    print_header
    print_success "安装完成！"
    echo ""
    echo -e "${CYAN}使用方法:${NC}"
    echo ""
    echo "1. 启动 Web 界面:"
    echo -e "   ${GREEN}cd $INSTALL_DIR${NC}"
    echo -e "   ${GREEN}./gada${NC}"
    echo -e "   然后访问: http://localhost:3456"
    echo ""
    echo "2. 使用命令行:"
    echo -e "   ${GREEN}./gada-cli${NC}"
    echo ""
    echo "3. 配置 AI:"
    echo -e "   编辑 ${YELLOW}$INSTALL_DIR/.env${NC} 文件"
    echo ""
    echo -e "${CYAN}需要帮助?${NC}"
    echo "  • 文档: https://github.com/4129163/github-deploy-assistant#readme"
    echo "  • Issues: https://github.com/4129163/github-deploy-assistant/issues"
    echo ""
    echo -e "${GREEN}🎉 开始使用 GitHub Deploy Assistant!${NC}"
    echo ""
}

# 主函数
main() {
    print_header
    
    check_requirements
    select_install_dir
    install_gada
    configure_ai
    create_launcher
    add_to_path
    print_completion
}

# 运行
main "$@"
