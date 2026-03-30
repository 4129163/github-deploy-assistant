/**
 * 市面上主流开发环境工具数据
 * 包含名称、分类、官网、描述、小白向安装教程
 */

const ENV_TOOLS_DATA = [
  // ── 运行环境 ────────────────────────────────────────
  {
    id: 'node',
    name: 'Node.js',
    category: '运行环境',
    icon: '🟩',
    desc: '让你的电脑能运行 JavaScript 代码，是绝大多数前端/全栈项目的基础。',
    website: 'https://nodejs.org',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '打开官网下载页', detail: '用浏览器打开 https://nodejs.org，你会看到两个绿色按钮，一个写着「LTS」（长期支持版），一个写着「Current」（最新版）。选左边那个「LTS」，更稳定。点击按钮，浏览器会自动开始下载一个安装包（文件名类似 node-v20.x.x-x64.msi）。' },
        { title: '安装（Windows）', detail: '下载完成后，找到刚下载的文件，双击它打开。弹出安装向导，一路点「Next」就行，所有选项保持默认不用改。遇到「I accept the terms」的勾选框，打上勾再点 Next。最后点「Install」，等进度条走完，点「Finish」。' },
        { title: '验证安装是否成功', detail: '按 Win键+R，输入 cmd，按回车，打开一个黑色的命令窗口。在窗口里输入：node --version，然后按回车。如果出现类似「v20.12.0」这样的版本号，说明安装成功了！再输入：npm --version，按回车，也会出现版本号，说明 npm（包管理工具）也装好了。' },
        { title: '安装（Linux/macOS）', detail: '打开终端（macOS 按 Command+空格搜「Terminal」；Linux 右键桌面找「打开终端」或按 Ctrl+Alt+T）。推荐用 nvm 安装，更方便管理版本。先安装 nvm（见 nvm 教程），再运行：nvm install --lts，按回车等待下载完成即可。' },
      ],
      tips: ['建议安装 LTS 版本，更稳定。', '安装 Node.js 会自动附带 npm，不需要单独安装。', '如果命令窗口显示「不是内部或外部命令」，尝试重启命令窗口或重启电脑。'],
    },
  },
  {
    id: 'python',
    name: 'Python',
    category: '运行环境',
    icon: '🐍',
    desc: '非常流行的编程语言，AI/机器学习/数据处理/爬虫项目必备。',
    website: 'https://www.python.org',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '打开官网下载页', detail: '用浏览器打开 https://www.python.org/downloads/，页面会自动显示适合你系统的最新版本，有一个黄色的「Download Python 3.x.x」按钮，点击下载。' },
        { title: '安装（Windows）—— 注意关键步骤', detail: '双击下载的安装包，弹出安装窗口。⚠️ 重要：在第一个页面底部，一定要勾选「Add Python to PATH」这个选项，再点「Install Now」。这一步很多人忘了，后面会出问题。等待安装完成，看到「Setup was successful」就表示成功了。' },
        { title: '验证安装', detail: '按 Win+R，输入 cmd，回车。输入：python --version，回车。出现「Python 3.x.x」就成功了。再输入：pip --version，回车，出现版本号说明包管理工具也 OK。' },
        { title: '安装（macOS）', detail: 'macOS 自带 Python 2，但我们需要 Python 3。推荐用 brew 安装（见 Homebrew 教程）：brew install python3。或者直接去官网下载 .pkg 文件双击安装。' },
        { title: '安装（Linux）', detail: '大多数 Linux 已内置 Python 3。打开终端，输入：sudo apt install python3 python3-pip，按回车，输入密码，然后一路按 Y 确认。' },
      ],
      tips: ['Windows 安装时一定要勾选「Add Python to PATH」！', '用 python3 和 pip3 命令（Linux/macOS），Windows 上一般直接用 python 和 pip。', '建议搭配 pyenv 或 conda 管理多个版本。'],
    },
  },
  {
    id: 'java',
    name: 'Java (JDK)',
    category: '运行环境',
    icon: '☕',
    desc: '企业级开发语言，Android App、Spring 后端项目必需。',
    website: 'https://adoptium.net',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '下载 JDK', detail: '推荐使用 Eclipse Temurin（免费且稳定），打开 https://adoptium.net，选择你的操作系统和版本（推荐 Java 17 LTS），下载对应的安装包。' },
        { title: '安装（Windows）', detail: '双击安装包，一路 Next，安装向导会自动配置环境变量。安装完成后重启命令窗口。' },
        { title: '验证安装', detail: '打开命令窗口（Win+R，输入 cmd），输入：java --version，回车，出现版本号即成功。再输入：javac --version，验证编译器也安装好了。' },
      ],
      tips: ['Java 8、11、17、21 都是 LTS 版本，推荐选 17 或 21。', '有些老项目需要 Java 8，可以用 SDKMAN 管理多版本。'],
    },
  },
  {
    id: 'go',
    name: 'Go',
    category: '运行环境',
    icon: '🐹',
    desc: 'Google 开发的高性能语言，适合写后端服务、命令行工具、云原生应用。',
    website: 'https://go.dev',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '下载安装包', detail: '打开 https://go.dev/dl/，选择你的操作系统对应的安装包（Windows 选 .msi，macOS 选 .pkg）下载。' },
        { title: '安装', detail: 'Windows：双击 .msi 文件，一路 Next 即可，会自动配置 PATH。macOS：双击 .pkg 文件，按提示安装。Linux：打开终端，运行 sudo tar -C /usr/local -xzf go*.tar.gz，然后在 ~/.bashrc 末尾加上 export PATH=$PATH:/usr/local/go/bin，再运行 source ~/.bashrc。' },
        { title: '验证', detail: '打开终端或命令窗口，输入：go version，回车，出现版本号即成功。' },
      ],
      tips: ['Go 的安装包自带所有工具，不需要额外安装编译器。', '项目依赖用 go mod 管理，不需要额外包管理工具。'],
    },
  },
  {
    id: 'rust',
    name: 'Rust',
    category: '运行环境',
    icon: '🦀',
    desc: '内存安全的系统级语言，性能媲美 C/C++，近年来非常热门。',
    website: 'https://www.rust-lang.org',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '安装 rustup（官方推荐方式）', detail: 'macOS/Linux：打开终端，复制粘贴这条命令然后按回车：curl --proto =https --tlsv1.2 -sSf https://sh.rustup.rs | sh，出现选项时输入 1 然后回车，等待安装完成。Windows：打开 https://rustup.rs，下载 rustup-init.exe 双击运行，按提示操作。' },
        { title: '让终端识别 rust 命令', detail: 'macOS/Linux：关闭当前终端，重新打开一个新终端，或者运行：source $HOME/.cargo/env。Windows：重新打开命令窗口即可。' },
        { title: '验证安装', detail: '输入：rustc --version，回车，出现版本号即成功。再输入：cargo --version，验证包管理工具 Cargo 也装好了。' },
      ],
      tips: ['rustup 是 Rust 的版本管理工具，顺带把编译器（rustc）和包管理器（cargo）都装好了。', 'Windows 可能需要先安装 Visual C++ Build Tools，安装时会有提示。'],
    },
  },
  {
    id: 'ruby',
    name: 'Ruby',
    category: '运行环境',
    icon: '💎',
    desc: 'Rails 框架的基础，写 Web 后端和脚本很方便。',
    website: 'https://www.ruby-lang.org',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: 'Windows 安装', detail: '打开 https://rubyinstaller.org，点「Download」，下载带「WITH DEVKIT」字样的版本（比如 Ruby+Devkit 3.2.x），双击安装，安装完勾选「ridk install」继续安装工具链，弹出命令窗口时按回车选默认。' },
        { title: 'macOS 安装', detail: 'macOS 自带旧版 Ruby，推荐用 rbenv 安装新版：brew install rbenv，然后 rbenv install 3.2.0，再 rbenv global 3.2.0。' },
        { title: 'Linux 安装', detail:'终端输入：sudo apt install ruby ruby-dev，按回车，输入密码，按 Y 确认。' },
        { title: '验证', detail: '输入：ruby --version，回车，出现版本号即成功。' },
      ],
      tips: ['Windows 推荐用 RubyInstaller，最省事。', '生产环境推荐用 rbenv 或 rvm 管理多版本。'],
    },
  },
  {
    id: 'php',
    name: 'PHP',
    category: '运行环境',
    icon: '🐘',
    desc: 'WordPress、Laravel 等建站/后端框架必备，全球最广泛的后端语言之一。',
    website: 'https://www.php.net',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: 'Windows 安装（推荐 XAMPP）', detail: '打开 https://www.apachefriends.org，下载 XAMPP（包含 PHP、Apache、MySQL 一体包），双击安装，选需要的组件，一路 Next，安装后从开始菜单打开 XAMPP Control Panel，点 Apache 的 Start 按钮。' },
        { title: 'Linux 安装', detail: '打开终端，输入：sudo apt install php php-cli php-common，按回车，按 Y 确认。' },
        { title: '验证', detail: '输入：php --version，回车，出现版本号即成功。' },
      ],
      tips: ['Windows 建议用 XAMPP 或 Laragon，集成了 PHP+MySQL+Nginx，不用单独配置。', 'Laravel 项目还需要 Composer。'],
    },
  },
  {
    id: 'deno',
    name: 'Deno',
    category: '运行环境',
    icon: '🦕',
    desc: 'Node.js 作者重新设计的 JavaScript 运行时，内置 TypeScript 支持，安全性更高。',
    website: 'https://deno.land',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: 'macOS/Linux 安装', detail: '打开终端，输入：curl -fsSL https://deno.land/install.sh | sh，按回车，等待安装完成。然后按提示把 deno 加入 PATH（复制提示里的 export 命令，粘贴到终端运行）。' },
        { title: 'Windows 安装', detail: '打开 PowerShell（搜索栏输入 PowerShell，右键「以管理员身份运行」），输入：irm https://deno.land/install.ps1 | iex，按回车等待安装。' },
        { title: '验证', detail: '输入：deno --version，回车，出现版本号即成功。' },
      ],
      tips: ['Deno 自带 TypeScript，不需要单独安装。', '适合新项目，老 Node.js 项目迁移需要一些适配工作。'],
    },
  },
  {
    id: 'bun',
    name: 'Bun',
    category: '运行环境',
    icon: '🍞',
    desc: '超快的 JavaScript 运行时，同时也是包管理器，比 npm 快很多倍。',
    website: 'https://bun.sh',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: 'macOS/Linux 安装', detail: '打开终端，输入：curl -fsSL https://bun.sh/install | bash，按回车，等待安装完成，按提示重新打开终端或运行 source ~/.bashrc。' },
        { title: 'Windows 安装', detail: '打开 PowerShell，输入：irm bun.sh/install.ps1 | iex，按回车等待安装。' },
        { title: '验证', detail: '输入：bun --version，回车，出现版本号即成功。' },
      ],
      tips: ['Bun 极快，可替代 node、npm、npx 等命令。', '大多数 Node.js 项目可以直接用 bun 运行，无需修改。'],
    },
  },

  // ── 版本管理 ────────────────────────────────────────
  {
    id: 'nvm',
    name: 'nvm',
    category: '版本管理',
    icon: '🔄',
    desc: 'Node.js 版本管理工具，可以在同一台电脑上安装和切换多个 Node.js 版本。',
    website: 'https://github.com/nvm-sh/nvm',
    os: ['macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '安装 nvm', detail: '打开终端，复制粘贴下面这条命令然后按回车：curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash。等待安装完成，终端会提示你需要重新加载配置。' },
        { title: '让终端识别 nvm 命令', detail: '关闭当前终端，重新打开一个新终端（这步很重要！）。输入 nvm --version，回车，出现版本号说明安装成功。' },
        { title: '用 nvm 安装 Node.js', detail: '输入：nvm install --lts，按回车，会自动下载安装最新的 LTS 版本 Node.js。安装完后输入：nvm use --lts，切换到该版本。输入：node --version，验证是否成功。' },
        { title: '常用命令', detail: 'nvm ls — 查看已安装的所有版本\nnvm install 18 — 安装 Node.js 18 版本\nnvm use 18 — 切换到 18 版本\nnvm alias default 18 — 设置默认版本为 18' },
      ],
      tips: ['Windows 用户请使用 nvm-windows：https://github.com/coreybutler/nvm-windows', '换了终端或重启电脑后，记得运行 nvm use <版本> 重新切换。', '如果 nvm 命令找不到，检查 ~/.bashrc 或 ~/.zshrc 里是否有 nvm 的初始化代码。'],
    },
  },
  {
    id: 'nvm-windows',
    name: 'nvm-windows',
    category: '版本管理',
    icon: '🪟',
    desc: 'Windows 专用的 Node.js 版本管理工具（nvm 的 Windows 版）。',
    website: 'https://github.com/coreybutler/nvm-windows',
    os: ['Windows'],
    tutorial: {
      steps: [
        { title: '下载安装包', detail: '打开 https://github.com/coreybutler/nvm-windows/releases，找到最新版本，点击「nvm-setup.exe」下载。' },
        { title: '安装', detail: '双击 nvm-setup.exe，一路 Next 完成安装。安装完成后打开命令窗口（Win+R，输入 cmd，回车）。' },
        { title: '安装 Node.js', detail: '在命令窗口输入：nvm install lts，按回车等待下载完成。然后输入：nvm use lts，按回车激活。输入：node --version 验证。' },
      ],
      tips: ['安装前先卸载已有的 Node.js，避免冲突。', '每次换版本后记得运行 nvm use <版本>。'],
    },
  },
  {
    id: 'pyenv',
    name: 'pyenv',
    category: '版本管理',
    icon: '🐍',
    desc: 'Python 版本管理工具，可以在同一台电脑上安装和切换多个 Python 版本。',
    website: 'https://github.com/pyenv/pyenv',
    os: ['macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '安装 pyenv（macOS）', detail: '先安装 Homebrew（见 Homebrew 教程），然后在终端输入：brew install pyenv，按回车等待安装完成。' },
        { title: '安装 pyenv（Linux）', detail: '打开终端，输入：curl https://pyenv.run | bash，按回车。等待完成后，按提示把初始化代码加到 ~/.bashrc（终端会显示具体要加的内容，复制粘贴进去）。然后关闭终端重新打开。' },
        { title: '用 pyenv 安装 Python', detail: '输入：pyenv install 3.12.3，按回车，等待下载安装（可能需要几分钟）。安装完输入：pyenv global 3.12.3，设为默认版本。输入：python3 --version 验证。' },
      ],
      tips: ['Windows 推荐用 pyenv-win：https://github.com/pyenv-win/pyenv-win', '如果安装报错，可能缺少编译依赖，运行：sudo apt install -y build-essential libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev'],
    },
  },
  {
    id: 'conda',
    name: 'Conda / Miniconda',
    category: '版本管理',
    icon: '🅒',
    desc: 'Python 的环境和包管理工具，AI/数据科学项目常用，可以创建独立的虚拟环境。',
    website: 'https://docs.conda.io/en/latest/miniconda.html',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '下载 Miniconda', detail: '打开 https://docs.conda.io/en/latest/miniconda.html，选择你的操作系统对应的安装包（推荐 Python 3.11 或更新版本）下载。' },
        { title: '安装（Windows）', detail: '双击 .exe 安装包，一路 Next，安装选项选「Just Me」就行，勾选「Add to PATH」可以方便命令行使用（但安装程序不推荐，看个人需要）。' },
        { title: '安装（Linux/macOS）', detail: '打开终端，找到下载的 .sh 文件，输入：bash ~/Downloads/Miniconda3-latest-Linux-x86_64.sh，按回车，一路按 Enter/输入 yes 确认。完成后关闭终端重开。' },
        { title: '验证', detail: '输入：conda --version，回车，出现版本号即成功。输入：conda create -n myenv python=3.11 创建虚拟环境，conda activate myenv 激活它。' },
      ],
      tips: ['conda 创建的每个虚拟环境都完全独立，互不干扰，非常适合 AI 项目。', 'Miniconda 是精简版，Anaconda 是完整版（包含大量科学计算包，几个 GB）。'],
    },
  },
  {
    id: 'sdkman',
    name: 'SDKMAN!',
    category: '版本管理',
    icon: '☕',
    desc: 'Java/Kotlin/Scala 等 JVM 语言的版本管理工具。',
    website: 'https://sdkman.io',
    os: ['macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '安装 SDKMAN', detail: '打开终端，输入：curl -s "https://get.sdkman.io" | bash，按回车。安装完成后，关闭终端重新打开，或者运行：source "$HOME/.sdkman/bin/sdkman-init.sh"。' },
        { title: '安装 Java', detail: '输入：sdk install java，按回车，会自动安装最新 LTS 版本。或者输入：sdk list java 查看所有可用版本，再选版本安装。' },
      ],
      tips: ['支持 Java、Kotlin、Gradle、Maven、Scala 等几十种工具的版本管理。'],
    },
  },

  // ── 包管理器 ─────────────────────────────────────────
  {
    id: 'npm',
    name: 'npm',
    category: '包管理器',
    icon: '📦',
    desc: 'Node.js 自带的包管理器，安装 Node.js 后自动获得，用来安装 JavaScript 依赖。',
    website: 'https://www.npmjs.com',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '随 Node.js 自动安装', detail: '不需要单独安装！安装完 Node.js 后，npm 就已经在你的电脑上了。打开命令窗口，输入：npm --version，回车，出现版本号就说明有了。' },
        { title: '常用命令', detail: 'npm install — 安装当前项目的所有依赖\nnpm install 包名 — 安装某个包\nnpm install -g 包名 — 全局安装一个工具\nnpm run start — 启动项目\nnpm run build — 打包项目' },
      ],
      tips: ['国内下载慢可以切换淘宝镜像：npm config set registry https://registry.npmmirror.com'],
    },
  },
  {
    id: 'yarn',
    name: 'Yarn',
    category: '包管理器',
    icon: '🧶',
    desc: 'Facebook 出品的 npm 替代品，安装速度更快，lock 文件更精确。',
    website: 'https://yarnpkg.com',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '安装 yarn', detail: '先确保已安装 Node.js 和 npm。然后打开命令窗口（Win+R 输入 cmd），输入：npm install -g yarn，按回车，等待安装完成。' },
        { title: '验证', detail: '输入：yarn --version，回车，出现版本号即成功。' },
        { title: '常用命令', detail: 'yarn install — 安装项目依赖\nyarn add 包名 — 添加一个包\nyarn global add 包名 — 全局安装\nyarn start — 启动项目' },
      ],
      tips: ['如果报权限错误，Windows 以管理员身份运行命令窗口；macOS/Linux 在命令前加 sudo。'],
    },
  },
  {
    id: 'pnpm',
    name: 'pnpm',
    category: '包管理器',
    icon: '⚡',
    desc: '比 npm/yarn 更快更省磁盘空间的包管理器，Monorepo 项目首选。',
    website: 'https://pnpm.io',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '安装 pnpm', detail: '打开命令窗口，输入：npm install -g pnpm，按回车等待安装。' },
        { title: '验证', detail: '输入：pnpm --version，回车，出现版本号即成功。' },
        { title: '常用命令', detail: 'pnpm install — 安装项目依赖\npnpm add 包名 — 添加包\npnpm run start — 启动项目' },
      ],
      tips: ['pnpm 通过硬链接共享包文件，同样的包只存一份，非常省空间。'],
    },
  },
  {
    id: 'pip',
    name: 'pip / pip3',
    category: '包管理器',
    icon: '🐍',
    desc: 'Python 的包管理工具，安装 Python 时自动附带，用来安装 Python 库。',
    website: 'https://pip.pypa.io',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '随 Python 自动安装', detail: '安装 Python 后 pip 就有了。打开命令窗口，输入：pip3 --version，回车，出现版本号即可。' },
        { title: '常用命令', detail: 'pip3 install 包名 — 安装一个库\npip3 install -r requirements.txt — 批量安装项目依赖\npip3 list — 查看已安装的所有包\npip3 uninstall 包名 — 卸载一个包' },
      ],
      tips: ['国内下载慢可以用镜像：pip3 install 包名 -i https://pypi.tuna.tsinghua.edu.cn/simple'],
    },
  },
  {
    id: 'git',
    name: 'Git',
    category: '版本控制',
    icon: '🐙',
    desc: '最流行的代码版本控制工具，和 GitHub/GitLab 配合使用，管理代码历史。',
    website: 'https://git-scm.com',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '下载安装（Windows）', detail: '打开 https://git-scm.com/download/win，会自动开始下载，双击安装包，一路 Next（编辑器那步可以选 VS Code），其他选项保持默认即可。' },
        { title: '安装（macOS）', detail: '打开终端，输入：brew install git（需要先安装 Homebrew）。或者安装 Xcode Command Line Tools：xcode-select --install。' },
        { title: '安装（Linux）', detail: '打开终端，输入：sudo apt install git，回车，输入密码，按 Y 确认。' },
        { title: '验证并配置身份', detail: '输入：git --version，回车，出现版本号即成功。然后设置你的名字和邮箱：\ngit config --global user.name "你的名字"\ngit config --global user.email "你的邮箱"' },
      ],
      tips: ['常用命令：git clone 地址（下载项目）/ git pull（拉取更新）/ git add . && git commit -m "说明"（提交）/ git push（推送）'],
    },
  },
  {
    id: 'docker',
    name: 'Docker',
    category: '容器/虚拟化',
    icon: '🐳',
    desc: '容器化工具，把应用和环境打包在一起，「一次构建，到处运行」。',
    website: 'https://www.docker.com',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '下载 Docker Desktop（Windows/macOS）', detail: '打开 https://www.docker.com/products/docker-desktop/，点「Download for Windows」或「Download for Mac」，下载安装包（约 500MB）。' },
        { title: '安装（Windows）', detail: '双击安装包，按提示安装，过程中可能需要启用 WSL 2（会提示重启）。安装完双击桌面 Docker 图标，等状态栏变绿色图标。' },
        { title: '安装（Linux）', detail: '打开终端，运行：curl -fsSL https://get.docker.com | sh，然后：sudo usermod -aG docker $USER，注销并重新登录。' },
        { title: '验证', detail: '输入：docker --version，出现版本号即成功。再输入：docker run hello-world，看到「Hello from Docker!」说明完全正常。' },
      ],
      tips: ['Windows 需要在 BIOS 开启虚拟化（Intel VT-x 或 AMD-V）。', 'Docker Desktop 在 Windows/macOS 有图形界面，直接点点就能管理容器。'],
    },
  },
  {
    id: 'nginx',
    name: 'Nginx',
    category: 'Web 服务器',
    icon: '🌐',
    desc: '高性能 Web 服务器，常用来做反向代理、负载均衡、静态文件服务。',
    website: 'https://nginx.org',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '安装（Linux）', detail: '打开终端，输入：sudo apt install nginx，回车，输入密码，按 Y 确认，安装完自动启动。' },
        { title: '验证', detail: '输入：nginx -v，回车，出现版本号即成功。打开浏览器访问 http://localhost，看到「Welcome to nginx!」说明正常运行。' },
        { title: '常用命令', detail: 'sudo systemctl start nginx — 启动\nsudo systemctl stop nginx — 停止\nsudo systemctl reload nginx — 重载配置（不中断服务）\nnginx -t — 检查配置文件有没有错误' },
      ],
      tips: ['配置文件在 /etc/nginx/sites-enabled/ 目录下。'],
    },
  },
  {
    id: 'mysql',
    name: 'MySQL',
    category: '数据库',
    icon: '🐬',
    desc: '最流行的关系型数据库，PHP/Java 项目的传统首选。',
    website: 'https://dev.mysql.com/downloads/',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '安装（Windows）', detail: '打开 https://dev.mysql.com/downloads/installer/，下载「MySQL Installer」，双击运行，选「Developer Default」，一路 Next，设置 root 密码时记好这个密码！' },
        { title: '安装（Linux）', detail: '打开终端，输入：sudo apt install mysql-server，按 Y 确认。安装完运行：sudo mysql_secure_installation，按提示设置密码。' },
        { title: '验证', detail: '输入：mysql --version，出现版本号即成功。登录测试：mysql -u root -p，输入密码，进入 MySQL 命令行说明正常。' },
      ],
      tips: ['记住 root 密码！忘了很麻烦。', 'Windows 推荐同时装 MySQL Workbench 图形管理工具。'],
    },
  },
  {
    id: 'redis',
    name: 'Redis',
    category: '数据库',
    icon: '🔴',
    desc: '内存数据库，速度极快，常用做缓存、消息队列、会话存储。',
    website: 'https://redis.io',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '安装（Linux）', detail: '打开终端，输入：sudo apt install redis-server，按 Y 确认，安装后自动启动。' },
        { title: '安装（macOS）', detail: '输入：brew install redis，然后：brew services start redis。' },
        { title: '安装（Windows）', detail: '去 https://github.com/tporadowski/redis/releases 下载最新 .msi 安装包，双击安装。' },
        { title: '验证', detail: '输入：redis-cli ping，回车，返回「PONG」说明 Redis 正常运行。' },
      ],
      tips: ['Redis 默认不设密码，生产环境务必配置密码。'],
    },
  },
  {
    id: 'pm2',
    name: 'PM2',
    category: '进程管理',
    icon: '⚙️',
    desc: 'Node.js 进程管理工具，让你的 Node 应用在后台持续运行，崩溃自动重启。',
    website: 'https://pm2.keymetrics.io',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '安装 PM2', detail: '打开命令窗口，输入：npm install -g pm2，按回车等待安装。' },
        { title: '验证', detail: '输入：pm2 --version，回车，出现版本号即成功。' },
        { title: '常用命令', detail: 'pm2 start app.js — 启动应用\npm2 start app.js --name 应用名 — 起个名字\npm2 list — 查看所有运行中的应用\npm2 logs — 查看日志\npm2 restart 应用名 — 重启\npm2 stop 应用名 — 停止\npm2 startup — 设置开机自启' },
      ],
      tips: ['PM2 非常适合生产环境部署 Node.js 应用。'],
    },
  },
  {
    id: 'homebrew',
    name: 'Homebrew',
    category: '包管理器',
    icon: '🍺',
    desc: 'macOS/Linux 的软件包管理器，一条命令安装各种开发工具，非常方便。',
    website: 'https://brew.sh',
    os: ['macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '安装 Homebrew', detail: '打开终端（macOS：Command+空格，搜索「Terminal」，点开）。复制下面这条命令，粘贴到终端按回车：/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"。按提示输入电脑密码（输入时看不到字符，正常的），再按 Enter 确认安装。' },
        { title: '验证', detail: '安装完后，输入：brew --version，回车，出现版本号即成功。' },
        { title: '常用命令', detail: 'brew install 工具名 — 安装工具（如 brew install git）\nbrew update — 更新 Homebrew 自身\nbrew upgrade — 更新所有已安装的工具\nbrew list — 查看已安装的工具' },
      ],
      tips: ['国内安装可能较慢，可以用国内镜像源。', 'Homebrew 是 macOS 开发者必装工具，装了它之后安装其他工具就很方便了。'],
    },
  },
  {
    id: 'vscode',
    name: 'VS Code',
    category: '编辑器/IDE',
    icon: '💙',
    desc: '微软出品的免费代码编辑器，最流行的开发工具，几乎支持所有语言。',
    website: 'https://code.visualstudio.com',
    os: ['Windows', 'macOS', 'Linux'],
    tutorial: {
      steps: [
        { title: '下载安装', detail: '打开 https://code.visualstudio.com，页面会自动识别你的系统，点大大的蓝色「Download」按钮下载，双击安装包，一路 Next，建议勾选「添加到右键菜单」选项，方便。' },
        { title: '安装中文界面', detail: '打开 VS Code 后，按 Ctrl+Shift+X（Mac 是 Command+Shift+X）打开扩展商店，搜索「Chinese」，找到「Chinese (Simplified) Language Pack」，点「Install」，安装完按提示重启即可。' },
      ],
      tips: ['推荐安装扩展：Prettier（代码格式化）、GitLens（Git 增强）、对应语言的扩展包。'],
    },
  },
  {
    id: 'wsl',
    name: 'WSL 2（Windows Subsystem for Linux）',
    category: '开发环境',
    icon: '🪟',
    desc: 'Windows 上运行 Linux 的子系统，让你在 Windows 上无缝使用 Linux 工具。',
    website: 'https://docs.microsoft.com/windows/wsl/',
    os: ['Windows'],
    tutorial: {
      steps: [
        { title: '开启 WSL 2', detail: '右键点击开始菜单，选「Windows PowerShell（管理员）」或「终端（管理员）」，在弹出的窗口里输入：wsl --install，按回车。系统会自动安装 WSL 2 和 Ubuntu，过程中需要重启电脑。' },
        { title: '重启后设置', detail: '重启后会自动打开一个 Ubuntu 终端，按提示设置 Linux 的用户名和密码（这个密码以后 sudo 命令会用到，记住它）。' },
        { title: '验证', detail: '打开开始菜单，搜索「Ubuntu」，点击打开，出现命令行界面说明安装成功。输入：uname -a，回车，看到 Linux 字样即正常。' },
      ],
      tips: ['WSL 2 让你在 Windows 上获得近乎原生的 Linux 体验，强烈推荐 Windows 开发者安装。', 'VS Code 安装「WSL」扩展后可以直接在 WSL 环境里开发。'],
    },
  },
];

// 按 category 分组
function groupByCategory(tools) {
  const groups = {};
  tools.forEach(t => {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  });
  return groups;
}

module.exports = { ENV_TOOLS_DATA, groupByCategory };
