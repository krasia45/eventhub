#!/bin/bash
echo "🚀 이벤트허브 개발 환경 및 Superpowers 세팅을 시작합니다..."

# 1. zshrc 파일 생성
touch ~/.zshrc

# 2. NVM 및 Node.js 설치 (없는 경우에만)
if [ ! -d "$HOME/.nvm" ]; then
    echo "📦 NVM을 설치합니다..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if ! command -v node &> /dev/null; then
    echo "📦 Node.js LTS 버전을 설치합니다..."
    nvm install --lts
    nvm use --lts
fi

# 3. Claude Code 전역 설치 (이미 있으면 스킵됨)
if ! command -v claude &> /dev/null; then
    echo "🤖 Claude Code 설치 중..."
    npm install -g @anthropic-ai/claude-code
fi

# 4. 🔥 핵심: Superpowers 플러그인 자동 설치 명령어 주입
echo "⚡ Superpowers 스킬을 자동 장착합니다..."
claude plugin install superpowers@claude-plugins-official --yes 2>/dev/null || echo "이미 설치되어 있거나 수동 설치가 필요합니다."

echo "✅ 모든 세팅이 완료되었습니다!"
echo "👉 이제 터미널에 'claude'를 입력하여 바로 개발을 시작하세요."