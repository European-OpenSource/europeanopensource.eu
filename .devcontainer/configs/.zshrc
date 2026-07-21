# [harness-coding:START]
# Setup fpath for completions BEFORE compinit
fpath=(
  ~/.zsh/completions
  /usr/share/zsh/site-functions
  /usr/share/zsh/functions
  ~/.oh-my-zsh/custom/completions
  $fpath
)

autoload -Uz compinit
compinit

# Load project environment at shell startup
if [[ -f "${WORKSPACE_DIR:=/workspace}/.env.project" ]]; then
  source "${WORKSPACE_DIR}/.env.project"
fi
if [[ -f "${WORKSPACE_DIR:=/workspace}/.env" ]]; then
  source "${WORKSPACE_DIR}/.env"
fi

plugins=(
  git
  github
  python
  pip
  node
  npm
  yarn
  docker
  docker-compose
  vscode
  zsh-autosuggestions
  zsh-syntax-highlighting
)

setopt PROMPT_SUBST
autoload -Uz vcs_info
precmd_vcs_info() { vcs_info }
precmd_functions+=( precmd_vcs_info )
zstyle ':vcs_info:git:*' formats ' (%b)'
zstyle ':vcs_info:*' enable git

PROMPT='%F{magenta}%n%f # %2~ %F{green}${vcs_info_msg_0_}%f $ '

HISTFILE=~/.zsh_history
HISTSIZE=50000
SAVEHIST=50000
setopt SHARE_HISTORY
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_FIND_NO_DUPS
setopt HIST_REDUCE_BLANKS
setopt AUTO_CD
setopt AUTO_PUSHD
setopt CORRECT
setopt EXTENDED_GLOB

bindkey '^[[A' history-beginning-search-backward
bindkey '^[[B' history-beginning-search-forward
bindkey '^ ' autosuggest-accept

zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'

zstyle ':completion:*' menu select

zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
# [harness-coding:END]

# ── Your customizations: add anything below this line ─────────────────────────
# This section is never touched by the template update script.
