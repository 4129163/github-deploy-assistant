const projectTypeMap = require('../../data/projectTypeMap');

class READMEGenerator {
  static generate(options) {
    const {
      projectName,
      projectType,
      description,
      author,
      features = [],
      deploySteps = [],
      faq = []
    } = options;

    const projectInfo = projectTypeMap[projectType] || {};
    const year = new Date().getFullYear();

    return `# 🚀 ${projectName}

${description || '一个很棒的开源项目，一键即可部署使用'}

---

## 📋 前置准备（必须先做！）
> 所有需要的工具都给你列好了，直接点链接下载安装就行，都是免费的
| 工具名称 | 下载地址 | 安装说明 |
|---------|---------|---------|
| Git | https://git-scm.com/downloads | 一路点击下一步安装就行，不用改任何配置 |
| ${projectInfo.langName || 'Node.js'} | ${projectInfo.downloadUrl || 'https://nodejs.org/zh-cn/'} | 选择LTS版本安装，一路下一步 |

> ✅ 安装完成验证：打开电脑的「终端」或者「命令提示符」，分别输入下面两个命令，看到版本号输出就是安装成功了
> \`\`\`bash
> git --version
> node -v
> \`\`\`

---

## 🚀 一步一步部署教程（按顺序来，100%成功）
### 第一步：下载代码到本地
1. 打开终端，输入下面的命令，然后按回车
\`\`\`bash
git clone ${options.repoUrl}
\`\`\`
2. 看到输出「done」就说明下载完成了，然后输入下面的命令进入项目文件夹
\`\`\`bash
cd ${projectName}
\`\`\`

### 第二步：安装依赖
1. 在刚才的终端里继续输入下面的命令，按回车
\`\`\`bash
${projectInfo.installCmd || 'npm install'}
\`\`\`
2. 等待几分钟，看到输出「success」就说明安装完成了，如果看到红色错误也没关系，大部分情况不影响使用

### 第三步：启动项目
1. 继续输入下面的命令，按回车
\`\`\`bash
${projectInfo.startCmd || 'npm start'}
\`\`\`
2. 看到输出「Running on http://localhost:3000」或者类似提示就说明启动成功了
3. 打开浏览器，访问提示的地址，就能正常使用了！

---

## ✨ 项目功能
${features.length > 0 ? features.map(f => `- ✅ ${f}`).join('\\n') : `- ✅ 核心功能已经全部实现，直接使用即可`}

---

## 📌 常见问题（小白必看！遇到问题先看这里）
### 问题1：输入命令后提示「不是内部或外部命令」
> 解决方案：说明你刚才的工具没安装对，回到前置准备部分，重新安装对应的工具，安装完关闭终端再重新打开就好了

### 问题2：安装依赖的时候提示红色错误
> 解决方案：90%的情况是网络慢导致的，输入下面的命令换国内源再重新安装就行
> \`\`\`bash
> npm config set registry https://registry.npmmirror.com
> ${projectInfo.installCmd || 'npm install'}
> \`\`\`

### 问题3：启动后浏览器访问不了
> 解决方案：首先看终端有没有红色错误提示，如果没有的话，检查端口是不是被其他程序占用了，换个端口就行
${faq.length > 0 ? faq.map((q, i) => `\\n### 问题${i+4}：${q.question}\\n> 解决方案：${q.answer}`).join('\\n') : ''}

---

## 🔧 可自定义配置选项
> 所有可以改的配置都列在这里了，不想改的话直接用默认的就行
| 配置项 | 说明 | 可选值 | 默认值 |
|---------|---------|---------|---------|
| PORT | 服务启动端口 | 1024~65535之间的数字 | 3000 |
| DEBUG | 是否开启调试模式 | true/false | false |
| LANGUAGE | 界面语言 | zh-CN/en | zh-CN |

修改方法：在项目根目录创建一个名为.env的文件，把你要改的配置写进去就行，比如：
\`\`\`
PORT=8080
DEBUG=true
\`\`\`

---

## 📚 拓展学习资源
> 想深入学习的话可以看这些官方文档，都是中文的
- Git官方教程：https://git-scm.com/book/zh/v2
- ${projectInfo.langName || 'Node.js'}官方文档：${projectInfo.docUrl || 'https://nodejs.org/zh-cn/docs/'}
- 项目部署入门教程：https://developer.mozilla.org/zh-CN/docs/Learn/Common_questions/Tools_and_setup/set_up_a_local_testing_server

---

## 📄 开源协议
本项目采用 ${options.license || 'MIT'} 协议开源，详情查看 LICENSE 文件

---

## 💬 交流反馈
有问题可以在仓库的「Issues」板块提问，看到都会回复~
`;
  }
}

module.exports = READMEGenerator;
