/**
 * EXAMBANK — Universal Revision System
 * Modular, production-ready educational web application
 */

// ========================================
// 1. STATE MANAGEMENT
// ========================================
const AppState = (() => {
  let data = {
    questions: {
      true_false: [],
      mcq: [],
      short_answer: [],
      code: [],
      fill_in_the_blank: []
    },
    currentCategory: 'true_false',
    progress: {
      true_false: {},
      mcq: {},
      short_answer: {},
      code: {},
      fill_in_the_blank: {}
    },
    preferences: {
      theme: 'light',
      language: 'en'
    }
  };

  const get = () => data;
  
  const setProgress = (category, questionId, result) => {
    if (!data.progress[category]) {
      data.progress[category] = {};
    }
    data.progress[category][questionId] = result;
    saveToStorage();
  };

  const getProgress = (category) => data.progress[category] || {};

  const setPreference = (key, value) => {
    data.preferences[key] = value;
    saveToStorage();
  };

  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem('exambank_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        data.progress = parsed.progress || data.progress;
      }
      const prefs = localStorage.getItem('exambank_prefs');
      if (prefs) {
        const parsedPrefs = JSON.parse(prefs);
        data.preferences = { ...data.preferences, ...parsedPrefs };
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
  };

  const saveToStorage = () => {
    try {
      localStorage.setItem('exambank_progress', JSON.stringify({ progress: data.progress }));
      localStorage.setItem('exambank_prefs', JSON.stringify(data.preferences));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  };

  const resetProgress = (category) => {
    data.progress[category] = {};
    saveToStorage();
  };

  return {
    get,
    setProgress,
    getProgress,
    setPreference,
    loadFromStorage,
    saveToStorage,
    resetProgress
  };
})();

// ========================================
// 2. KEYWORD MANAGER
// ========================================
const KeywordManager = (() => {
  let keywords = [];
  let keywordMap = new Map();
  let loaded = false;

  const load = async () => {
    if (loaded) return keywords;
    
    try {
      const response = await fetch('keywords.json');
      const data = await response.json();
      keywords = data.keywords || [];
      
      // Build a map for quick lookup (lowercase term -> keyword data)
      keywordMap = new Map();
      keywords.forEach(kw => {
        keywordMap.set(kw.term.toLowerCase(), kw);
      });
      
      loaded = true;
      console.log(`[KeywordManager] Loaded ${keywords.length} keywords`);
      return keywords;
    } catch (e) {
      console.warn('[KeywordManager] Failed to load keywords:', e);
      return [];
    }
  };

  const getKeywords = () => keywords;

  const getByTerm = (term) => {
    return keywordMap.get(term.toLowerCase()) || null;
  };

  const isLoaded = () => loaded;

  return {
    load,
    getKeywords,
    getByTerm,
    isLoaded
  };
})();

// ========================================
// 3. UTILITY FUNCTIONS
// ========================================
const Utils = {
  shuffle: (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  escapeHtml: (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  debounce: (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  /**
   * Highlight keywords in text by wrapping them in span elements with tooltips.
   * @param {string} text - The text to process
   * @returns {string} - HTML string with highlighted keywords
   */
  highlightKeywords: (text) => {
    if (!text || !KeywordManager.isLoaded()) {
      return text;
    }

    let processedText = text;
    const keywords = KeywordManager.getKeywords();

    // Sort keywords by length (descending) to match longer terms first
    const sortedKeywords = [...keywords].sort((a, b) => b.term.length - a.term.length);

    // Create a regex pattern that matches any keyword (case-insensitive)
    const escapedTerms = sortedKeywords
      .map(kw => kw.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');

    if (!escapedTerms) return processedText;

    const regex = new RegExp(`\\b(${escapedTerms})\\b`, 'gi');

    processedText = processedText.replace(regex, (match) => {
      const keywordData = KeywordManager.getByTerm(match);
      if (!keywordData) return match;

      // Create a highlighted keyword element with tooltip
      const escapedTerm = Utils.escapeHtml(match);
      const escapedTranslation = Utils.escapeHtml(keywordData.translation_ar);
      const escapedDefinition = Utils.escapeHtml(keywordData.definition);
      const escapedDetails = Utils.escapeHtml(keywordData.details);

      return `<span class="keyword-highlight" data-term="${escapedTerm}" data-translation="${escapedTranslation}" data-definition="${escapedDefinition}" data-details="${escapedDetails}">${escapedTerm}</span>`;
    });

    return processedText;
  },

  /**
   * Initialize keyword tooltip event listeners on a container element.
   * @param {HTMLElement} container - The container to attach listeners to
   */
  initKeywordTooltips: (container) => {
    // Use event delegation on the document for better performance
    // This avoids cloning and losing existing event listeners
    if (!document._keywordTooltipInitialized) {
      document.addEventListener('mouseenter', (e) => {
        const keywordEl = e.target instanceof Element && e.target.closest('.keyword-highlight');
        if (!keywordEl) return;
        showTooltip(keywordEl);
      }, true); // Use capture phase

      document.addEventListener('mouseleave', (e) => {
        const keywordEl = e.target instanceof Element && e.target.closest('.keyword-highlight');
        if (!keywordEl) return;
        hideTooltip();
      }, true); // Use capture phase

      document._keywordTooltipInitialized = true;
      console.log('[KeywordTooltips] Global event listeners initialized');
    }
  },

  /**
   * Format short answer text into readable HTML with proper spacing and bullet points.
   * @param {string} text - The answer text (may already contain HTML from keyword highlighting)
   * @returns {string} - Formatted HTML string
   */
  formatShortAnswer: (text) => {
    if (!text) return '';

    // Split into lines
    const lines = text.split('\n');
    let result = '';
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === '') {
        // Close any open list
        if (inList) {
          result += '</ul>';
          inList = false;
        }
        result += '<br>';
      } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
        // Bullet point
        if (!inList) {
          result += '<ul class="answer-list">';
          inList = true;
        }
        // Remove the bullet character and trim
        const content = trimmed.replace(/^[•\-*]\s*/, '');
        result += `<li>${content}</li>`;
      } else {
        // Regular text line
        if (inList) {
          result += '</ul>';
          inList = false;
        }
        result += `<div class="answer-line">${trimmed}</div>`;
      }
    }

    // Close any remaining open list
    if (inList) {
      result += '</ul>';
    }

    return result;
  }
};

// ========================================
// Tooltip Management
// ========================================
let activeTooltip = null;
let activeKeywordEl = null;

// Update tooltip position on scroll
window.addEventListener('scroll', () => {
  if (activeTooltip && activeKeywordEl) {
    positionTooltip(activeKeywordEl);
  }
});

const showTooltip = (keywordEl) => {
  // Hide any existing tooltip
  hideTooltip();

  activeKeywordEl = keywordEl;
  const term = keywordEl.dataset.term;
  const translation = keywordEl.dataset.translation;
  const definition = keywordEl.dataset.definition;
  const details = keywordEl.dataset.details;

  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'keyword-tooltip';
  tooltip.id = 'active-keyword-tooltip';
  tooltip.innerHTML = `
    <div class="tooltip-term">${term}</div>
    <div class="tooltip-translation">${translation}</div>
    <div class="tooltip-definition">${definition}</div>
    <div class="tooltip-details">${details}</div>
  `;

  document.body.appendChild(tooltip);
  activeTooltip = tooltip;

  // Position tooltip
  positionTooltip(keywordEl);
};

const hideTooltip = () => {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
    activeKeywordEl = null;
  }
};

const positionTooltip = (keywordEl) => {
  if (!activeTooltip) return;

  const rect = keywordEl.getBoundingClientRect();
  const tooltipRect = activeTooltip.getBoundingClientRect();

  // Default position: below the keyword
  let top = rect.bottom + 8;
  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

  // Adjust if tooltip goes off-screen
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (left < 10) {
    left = 10;
  } else if (left + tooltipRect.width > viewportWidth - 10) {
    left = viewportWidth - tooltipRect.width - 10;
  }

  if (top + tooltipRect.height > viewportHeight - 10) {
    // Position above if not enough space below
    top = rect.top - tooltipRect.height - 8;
  }

  activeTooltip.style.top = `${top + window.scrollY}px`;
  activeTooltip.style.left = `${left}px`;
};

// ========================================
// 4. SYNTAX HIGHLIGHTER (VS Code-like)
// ========================================
const SyntaxHighlighter = (() => {
  // Token definitions — JS + Python keywords
  const KEYWORDS = new Set([
    'function', 'class', 'return', 'if', 'else', 'elif', 'for', 'while',
    'in', 'not', 'and', 'or', 'is', 'True', 'False', 'None', 'try', 'except',
    'finally', 'with', 'as', 'pass', 'break', 'continue', 'lambda', 'yield',
    'global', 'nonlocal', 'assert', 'raise', 'del', 'import', 'from',
    'def', 'const', 'let', 'var', 'new', 'this', 'typeof', 'instanceof',
    'async', 'await', 'catch', 'throw', 'do', 'switch', 'case', 'default',
    'export', 'extends', 'super', 'yield', 'of', 'void', 'delete',
    'print', 'True', 'False', 'None'
  ]);

  const BUILTINS = new Set([
    'console', 'document', 'window', 'Math', 'JSON', 'Array', 'Object', 'String',
    'Number', 'Boolean', 'Promise', 'setTimeout', 'setInterval', 'parseInt',
    'parseFloat', 'alert', 'fetch', 'Map', 'Set', 'Error', 'RegExp',
    'pd', 'plt', 'sns', 'np', 'DataFrame', 'Series',
    'print', 'len', 'range', 'int', 'str', 'float', 'list',
    'dict', 'set', 'tuple', 'type', 'isinstance', 'enumerate', 'zip',
    'sorted', 'reversed', 'sum', 'min', 'max', 'abs', 'open',
    'read_csv', 'show', 'hist', 'boxplot', 'heatmap', 'corr', 'mean', 'median', 'std'
  ]);

  /**
   * Tokenize source code using a multi-pass regex approach.
   * Returns an array of { type, value } tokens.
   */
  const tokenize = (source) => {
    const tokens = [];
    let remaining = source;

    // Regex patterns in priority order
    const patterns = [
      // Multi-line comments: /* ... */
      { type: 'comment', regex: /^\/\*[\s\S]*?\*\// },
      // Single-line comments: // or #
      { type: 'comment', regex: /^(?:\/\/|#)[^\n]*/ },
      // Triple-quoted strings (Python)
      { type: 'string', regex: /^(?:"""[\s\S]*?"""|'''[\s\S]*?''')/ },
      // Strings: "..." or '...' (handle escape)
      { type: 'string', regex: /^"(?:[^"\\]|\\.)*"/ },
      { type: 'string', regex: /^'(?:[^'\\]|\\.)*'/ },
      // Template literals (JS): `...`
      { type: 'string', regex: /^`(?:[^`\\]|\\.)*`/ },
      // Numbers: 42, 3.14, 0xFF, 1e10
      { type: 'number', regex: /^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)/ },
      // Multi-char operators
      { type: 'operator', regex: /^(?:===|!==|==|!=|<=|>=|=>|&&|\|\||\?\?|\.\.\.|\*\*|<<|>>|\/\/|[+\-*/%=<>!&|^~?:])/ },
      // Identifiers & dot notation
      { type: 'ident', regex: /^[a-zA-Z_$][\w$]*/ },
      // Dot access
      { type: 'dot', regex: /^\./ },
      // Brackets / punctuation
      { type: 'bracket', regex: /^[{}()\[\];,]/ },
      // Whitespace (preserve)
      { type: 'ws', regex: /^[ \t]+/ },
      // Newline
      { type: 'nl', regex: /^\r?\n/ },
      // Fallback — any single char
      { type: 'text', regex: /^./ }
    ];

    while (remaining.length > 0) {
      let matched = false;

      for (const { type, regex } of patterns) {
        const m = remaining.match(regex);
        if (m) {
          tokens.push({ type, value: m[0] });
          remaining = remaining.slice(m[0].length);
          matched = true;
          break;
        }
      }

      if (!matched) {
        tokens.push({ type: 'text', value: remaining[0] });
        remaining = remaining.slice(1);
      }
    }

    return tokens;
  };

  /**
   * Classify an identifier token as keyword, builtin, variable, or function.
   * Looks ahead to next non-ws/non-nl token — if it's '(' → function call.
   */
  const classifyIdent = (tokens, index) => {
    const value = tokens[index].value;

    if (KEYWORDS.has(value)) return 'keyword';
    if (BUILTINS.has(value)) return 'builtin';

    // Peek ahead for '(' to detect function calls
    for (let j = index + 1; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type === 'ws' || t.type === 'nl') continue;
      if (t.type === 'bracket' && t.value === '(') return 'function';
      break;
    }

    return 'variable';
  };

  /**
   * Escape HTML entities in a string.
   */
  const esc = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  /**
   * Convert tokens array into highlighted HTML string.
   */
  const tokensToHtml = (tokens) => {
    let html = '';

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const safe = esc(t.value);

      switch (t.type) {
        case 'comment':
          html += `<span class="tk-comment">${safe}</span>`;
          break;
        case 'string':
          html += `<span class="tk-string">${safe}</span>`;
          break;
        case 'number':
          html += `<span class="tk-number">${safe}</span>`;
          break;
        case 'operator':
          html += `<span class="tk-operator">${safe}</span>`;
          break;
        case 'bracket':
          html += `<span class="tk-bracket">${safe}</span>`;
          break;
        case 'dot':
          html += `<span class="tk-operator">${safe}</span>`;
          break;
        case 'ident':
          const cls = classifyIdent(tokens, i);
          html += `<span class="tk-${cls}">${safe}</span>`;
          break;
        case 'nl':
          html += safe;
          break;
        case 'ws':
          html += safe;
          break;
        default:
          html += safe;
      }
    }

    return html;
  };

  /**
   * Public API — highlight source code.
   * Returns { html, lineCount }.
   */
  const highlight = (source) => {
    const tokens = tokenize(source);
    const html = tokensToHtml(tokens);
    const lineCount = source.split('\n').length;
    return { html, lineCount };
  };

  return { highlight };
})();

// ========================================
// 4. PROGRESS MANAGER
// ========================================
const ProgressManager = (() => {
  const updateProgress = () => {
    const state = AppState.get();
    let totalAnswered = 0;
    let totalQuestions = 0;
    let totalCorrect = 0;

    const categories = ['true_false', 'mcq', 'short_answer', 'code', 'fill_in_the_blank'];

    categories.forEach(cat => {
      const questions = state.questions[cat] || [];
      const progress = AppState.getProgress(cat);
      const answered = Object.keys(progress).length;
      totalAnswered += answered;
      totalQuestions += questions.length;

      // Count correct
      Object.values(progress).forEach(p => {
        if (p.correct) totalCorrect++;
      });

      // Update dashboard rings
      const ringId = cat === 'true_false' ? 'tf' : cat === 'mcq' ? 'mcq' : cat === 'short_answer' ? 'sa' : cat === 'code' ? 'code' : 'fib';
      const ringEl = document.getElementById(`${ringId}Ring`);
      const ringTextEl = document.getElementById(`${ringId}RingText`);
      const answeredEl = document.getElementById(`${ringId}Answered`);
      const totalEl = document.getElementById(`${ringId}Total`);

      if (ringEl && questions.length > 0) {
        const percent = Math.round((answered / questions.length) * 100);
        ringEl.setAttribute('stroke-dasharray', `${percent}, 100`);
        ringTextEl.textContent = `${percent}%`;
      }
      if (answeredEl) answeredEl.textContent = answered;
      if (totalEl) totalEl.textContent = questions.length;
    });

    // Update progress bar
    const percent = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;
    const progressFill = document.getElementById('progressFill');
    const progressValue = document.getElementById('progressValue');
    const answeredCount = document.getElementById('answeredCount');
    const totalCount = document.getElementById('totalCount');
    const correctCount = document.getElementById('correctCount');

    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressValue) progressValue.textContent = `${percent}%`;
    if (answeredCount) answeredCount.textContent = totalAnswered;
    if (totalCount) totalCount.textContent = totalQuestions;
    if (correctCount) correctCount.textContent = totalCorrect;

    // Accuracy
    const accuracyEl = document.getElementById('accuracyValue');
    const completedEl = document.getElementById('completedValue');
    if (accuracyEl) {
      const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
      accuracyEl.textContent = `${accuracy}%`;
    }
    if (completedEl) {
      completedEl.textContent = `${totalAnswered} / ${totalQuestions}`;
    }
  };

  return { updateProgress };
})();

// ========================================
// 5. TRUE/FALSE MODULE
// ========================================
const TrueFalseModule = (() => {
  const render = (questions) => {
    const container = document.getElementById('tfQuestions');
    container.innerHTML = '';

    questions.forEach((q, index) => {
      const progress = AppState.getProgress('true_false');
      const answered = progress[q.id];
      const state = AppState.get();
      const isArabic = state.preferences.language === 'ar';
      const questionText = isArabic && q.question_ar ? q.question_ar : q.question_en;

      const card = document.createElement('div');
      card.className = `question-card${answered ? ' answered' : ''}`;
      card.id = `tf-${q.id}`;
      card.innerHTML = `
        <div class="question-header">
          <span class="question-number">Question ${index + 1}</span>
        </div>
        <p class="question-text">${Utils.highlightKeywords(Utils.escapeHtml(questionText))}</p>
        <div class="tf-options">
          <button class="tf-btn" data-answer="true" ${answered ? 'disabled' : ''}>
            ${isArabic ? 'صحيح' : 'True'}
          </button>
          <button class="tf-btn" data-answer="false" ${answered ? 'disabled' : ''}>
            ${isArabic ? 'خطأ' : 'False'}
          </button>
        </div>
        <div class="feedback-container"></div>
        <div class="explanation-container" style="display:none">
          <div class="explanation">
            <div class="explanation-label">${isArabic ? 'الشرح' : 'Explanation'}</div>
            <div class="explanation-text">${Utils.highlightKeywords(Utils.escapeHtml(q.explanation || ''))}</div>
          </div>
        </div>
      `;

      container.appendChild(card);

      // Handle answered state
      if (answered) {
        const btns = card.querySelectorAll('.tf-btn');
        btns.forEach(btn => {
          const btnAnswer = btn.dataset.answer === 'true';
          if (btnAnswer === q.answer) {
            btn.classList.add('show-correct');
          }
          if (answered.userAnswer === btn.dataset.answer) {
            btn.classList.add(answered.correct ? 'selected-correct' : 'selected-incorrect');
          }
        });

        const feedbackContainer = card.querySelector('.feedback-container');
        feedbackContainer.innerHTML = `
          <div class="feedback ${answered.correct ? 'feedback-correct' : 'feedback-incorrect'}">
            ${answered.correct 
              ? (isArabic ? '✓ إجابة صحيحة!' : '✓ Correct!') 
              : (isArabic ? '✗ إجابة خاطئة' : '✗ Incorrect')}
          </div>
        `;

        card.querySelector('.explanation-container').style.display = 'block';
      }

      // Event listeners
      const btns = card.querySelectorAll('.tf-btn');
      btns.forEach(btn => {
        btn.addEventListener('click', () => {
          if (answered) return;

          const userAnswer = btn.dataset.answer === 'true';
          const isCorrect = userAnswer === q.answer;

          AppState.setProgress('true_false', q.id, { correct: isCorrect, userAnswer });

          // Update UI
          btns.forEach(b => {
            b.disabled = true;
            const bAnswer = b.dataset.answer === 'true';
            if (bAnswer === q.answer) {
              b.classList.add('show-correct');
            }
          });

          btn.classList.add(isCorrect ? 'selected-correct' : 'selected-incorrect');

          card.classList.add('answered');

          const feedbackContainer = card.querySelector('.feedback-container');
          feedbackContainer.innerHTML = `
            <div class="feedback ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}">
              ${isCorrect 
                ? (isArabic ? '✓ إجابة صحيحة!' : '✓ Correct!') 
                : (isArabic ? '✗ إجابة خاطئة' : '✗ Incorrect')}
            </div>
          `;

          card.querySelector('.explanation-container').style.display = 'block';

          ProgressManager.updateProgress();
        });
      });
    });

    // Initialize keyword tooltips
    Utils.initKeywordTooltips(container);
  };

  const shuffle = () => {
    const container = document.getElementById('tfQuestions');
    const cards = Array.from(container.children);
    Utils.shuffle(cards).forEach(card => container.appendChild(card));
  };

  const reset = () => {
    AppState.resetProgress('true_false');
    const state = AppState.get();
    render(state.questions.true_false);
    ProgressManager.updateProgress();
  };

  return { render, shuffle, reset };
})();

// ========================================
// 6. MCQ MODULE
// ========================================
const MCQModule = (() => {
  const render = (questions) => {
    const container = document.getElementById('mcqQuestions');
    container.innerHTML = '';

    questions.forEach((q, index) => {
      const progress = AppState.getProgress('mcq');
      const answered = progress[q.id];
      const state = AppState.get();
      const isArabic = state.preferences.language === 'ar';
      const questionText = isArabic && q.question_ar ? q.question_ar : q.question_en;

      // Randomize options
      const optionEntries = Object.entries(q.options);
      const shuffledOptions = answered ? optionEntries : Utils.shuffle(optionEntries);

      const card = document.createElement('div');
      card.className = `question-card${answered ? ' answered' : ''}`;
      card.id = `mcq-${q.id}`;

      let optionsHTML = shuffledOptions.map(([key, value], optIndex) => {
        const letter = String.fromCharCode(65 + optIndex);
        const originalKey = key;
        return `
          <button class="mcq-option" data-key="${originalKey}" ${answered ? 'disabled' : ''}>
            <span class="option-letter">${letter}</span>
            <span class="option-text">${Utils.escapeHtml(value)}</span>
          </button>
        `;
      }).join('');

      card.innerHTML = `
        <div class="question-header">
          <span class="question-number">Question ${index + 1}</span>
        </div>
        <p class="question-text">${Utils.highlightKeywords(Utils.escapeHtml(questionText))}</p>
        <div class="mcq-options">
          ${optionsHTML}
        </div>
        <div class="feedback-container"></div>
        <div class="explanation-container" style="display:none">
          <div class="explanation">
            <div class="explanation-label">${isArabic ? 'الشرح' : 'Explanation'}</div>
            <div class="explanation-text">${Utils.highlightKeywords(Utils.escapeHtml(q.explanation || ''))}</div>
          </div>
        </div>
      `;

      container.appendChild(card);

      // Handle answered state
      if (answered) {
        const options = card.querySelectorAll('.mcq-option');
        options.forEach(opt => {
          if (opt.dataset.key === q.correct_answer) {
            opt.classList.add('show-correct');
          }
          if (opt.dataset.key === answered.userAnswer) {
            opt.classList.add(answered.correct ? 'selected-correct' : 'selected-incorrect');
          }
        });

        const feedbackContainer = card.querySelector('.feedback-container');
        feedbackContainer.innerHTML = `
          <div class="feedback ${answered.correct ? 'feedback-correct' : 'feedback-incorrect'}">
            ${answered.correct 
              ? (isArabic ? '✓ إجابة صحيحة!' : '✓ Correct!') 
              : (isArabic ? '✗ إجابة خاطئة' : '✗ Incorrect')}
          </div>
        `;

        card.querySelector('.explanation-container').style.display = 'block';
      }

      // Event listeners
      const options = card.querySelectorAll('.mcq-option');
      options.forEach(opt => {
        opt.addEventListener('click', () => {
          if (answered) return;

          const userAnswer = opt.dataset.key;
          const isCorrect = userAnswer === q.correct_answer;

          AppState.setProgress('mcq', q.id, { correct: isCorrect, userAnswer });

          // Update UI
          options.forEach(o => {
            o.disabled = true;
            if (o.dataset.key === q.correct_answer) {
              o.classList.add('show-correct');
            }
          });

          opt.classList.add(isCorrect ? 'selected-correct' : 'selected-incorrect');

          card.classList.add('answered');

          const feedbackContainer = card.querySelector('.feedback-container');
          feedbackContainer.innerHTML = `
            <div class="feedback ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}">
              ${isCorrect 
                ? (isArabic ? '✓ إجابة صحيحة!' : '✓ Correct!') 
                : (isArabic ? '✗ إجابة خاطئة' : '✗ Incorrect')}
            </div>
          `;

          card.querySelector('.explanation-container').style.display = 'block';

          ProgressManager.updateProgress();
        });
      });
    });

    // Initialize keyword tooltips
    Utils.initKeywordTooltips(container);
  };

  const shuffle = () => {
    const state = AppState.get();
    render(Utils.shuffle(state.questions.mcq));
  };

  const reset = () => {
    AppState.resetProgress('mcq');
    const state = AppState.get();
    render(state.questions.mcq);
    ProgressManager.updateProgress();
  };

  return { render, shuffle, reset };
})();

// ========================================
// 7. SHORT ANSWER MODULE
// ========================================
const ShortAnswerModule = (() => {
  const render = (questions) => {
    const container = document.getElementById('saQuestions');
    container.innerHTML = '';

    questions.forEach((q, index) => {
      const progress = AppState.getProgress('short_answer');
      const answered = progress[q.id];
      const state = AppState.get();
      const isArabic = state.preferences.language === 'ar';
      const questionText = isArabic && q.question_ar ? q.question_ar : q.question_en;

      const card = document.createElement('div');
      card.className = `question-card${answered ? ' answered' : ''}`;
      card.id = `sa-${q.id}`;
      card.innerHTML = `
        <div class="question-header">
          <span class="question-number">Question ${index + 1}</span>
        </div>
        <p class="question-text">${Utils.highlightKeywords(Utils.escapeHtml(questionText))}</p>
        <textarea
          class="short-answer-area"
          placeholder="${isArabic ? 'اكتب إجابتك هنا...' : 'Type your answer here...'}"
          ${answered ? 'disabled' : ''}
        >${answered ? Utils.escapeHtml(answered.userAnswer || '') : ''}</textarea>
        <div class="short-answer-actions">
          <button class="btn btn-primary show-answer-btn" ${answered ? 'style="display:none"' : ''}>
            ${isArabic ? 'إظهار الإجابة' : 'Show Answer'}
          </button>
        </div>
        <div class="model-answer-container" style="display:none">
          <div class="model-answer">
            <div class="model-answer-label">${isArabic ? 'الإجابة النموذجية' : 'Model Answer'}</div>
            <div class="model-answer-text">${Utils.formatShortAnswer(Utils.highlightKeywords(Utils.escapeHtml(q.answer)))}</div>
          </div>
        </div>
      `;

      container.appendChild(card);

      // Show answer button
      const showBtn = card.querySelector('.show-answer-btn');
      const modelAnswerContainer = card.querySelector('.model-answer-container');
      const textarea = card.querySelector('.short-answer-area');

      if (answered && answered.revealed) {
        modelAnswerContainer.style.display = 'block';
        textarea.disabled = true;
      }

      showBtn?.addEventListener('click', () => {
        const userAnswer = textarea.value.trim();
        
        // Mark as answered
        if (!answered) {
          AppState.setProgress('short_answer', q.id, {
            revealed: true,
            userAnswer
          });
          card.classList.add('answered');
        } else {
          AppState.setProgress('short_answer', q.id, {
            ...answered,
            revealed: true,
            userAnswer
          });
        }

        modelAnswerContainer.style.display = 'block';
        textarea.disabled = true;
        showBtn.style.display = 'none';

        ProgressManager.updateProgress();
      });
    });

    // Initialize keyword tooltips
    Utils.initKeywordTooltips(container);
  };

  const shuffle = () => {
    const container = document.getElementById('saQuestions');
    const cards = Array.from(container.children);
    Utils.shuffle(cards).forEach(card => container.appendChild(card));
  };

  return { render, shuffle };
})();

// ========================================
// 7b. FILL IN THE BLANK MODULE
// ========================================
const FillInTheBlankModule = (() => {
  const render = (questions) => {
    const container = document.getElementById('fibQuestions');
    container.innerHTML = '';

    questions.forEach((q, index) => {
      const progress = AppState.getProgress('fill_in_the_blank');
      const answered = progress[q.id];
      const state = AppState.get();
      const isArabic = state.preferences.language === 'ar';

      const card = document.createElement('div');
      card.className = `question-card${answered ? ' answered' : ''}`;
      card.id = `fib-${q.id}`;
      card.innerHTML = `
        <div class="question-header">
          <span class="question-number">Question ${index + 1}</span>
        </div>
        <p class="question-text">${Utils.highlightKeywords(Utils.escapeHtml(q.question))}</p>
        <div class="fib-input-group">
          <input
            type="text"
            class="fib-input"
            placeholder="${isArabic ? 'اكتب الإجابة هنا...' : 'Type your answer here...'}"
            value="${answered ? Utils.escapeHtml(answered.userAnswer || '') : ''}"
            ${answered ? 'disabled' : ''}
            autocomplete="off"
            spellcheck="false"
          />
          <button class="btn btn-primary fib-submit-btn" ${answered ? 'style="display:none"' : ''}>
            ${isArabic ? 'تحقق' : 'Check'}
          </button>
        </div>
        <div class="feedback-container"></div>
        <div class="model-answer-container" style="display:none">
          <div class="model-answer">
            <div class="model-answer-label">${isArabic ? 'الإجابة الصحيحة' : 'Correct Answer'}</div>
            <div class="model-answer-text">${Utils.highlightKeywords(Utils.escapeHtml(q.answer))}</div>
          </div>
        </div>
      `;

      container.appendChild(card);

      const input = card.querySelector('.fib-input');
      const submitBtn = card.querySelector('.fib-submit-btn');
      const modelAnswerContainer = card.querySelector('.model-answer-container');
      const feedbackContainer = card.querySelector('.feedback-container');

      // Handle answered state
      if (answered) {
        input.disabled = true;
        modelAnswerContainer.style.display = 'block';
        feedbackContainer.innerHTML = `
          <div class="feedback ${answered.correct ? 'feedback-correct' : 'feedback-incorrect'}">
            ${answered.correct
              ? (isArabic ? '✓ إجابة صحيحة!' : '✓ Correct!')
              : (isArabic ? '✗ إجابة خاطئة' : '✗ Incorrect')}
          </div>
        `;
      }

      // Submit handler
      const checkAnswer = () => {
        if (answered) return;

        const userAnswer = input.value.trim();
        if (!userAnswer) return;

        const isCorrect = userAnswer.toLowerCase() === q.answer.toLowerCase();

        AppState.setProgress('fill_in_the_blank', q.id, { correct: isCorrect, userAnswer });

        input.disabled = true;
        submitBtn.style.display = 'none';
        card.classList.add('answered');

        feedbackContainer.innerHTML = `
          <div class="feedback ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}">
            ${isCorrect
              ? (isArabic ? '✓ إجابة صحيحة!' : '✓ Correct!')
              : (isArabic ? '✗ إجابة خاطئة' : '✗ Incorrect')}
          </div>
        `;

        modelAnswerContainer.style.display = 'block';
        ProgressManager.updateProgress();
      };

      submitBtn?.addEventListener('click', checkAnswer);

      // Allow Enter key to submit
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !answered) {
          e.preventDefault();
          checkAnswer();
        }
      });
    });

    // Initialize keyword tooltips
    Utils.initKeywordTooltips(container);
  };

  const shuffle = () => {
    const container = document.getElementById('fibQuestions');
    const cards = Array.from(container.children);
    Utils.shuffle(cards).forEach(card => container.appendChild(card));
  };

  const reset = () => {
    AppState.resetProgress('fill_in_the_blank');
    const state = AppState.get();
    render(state.questions.fill_in_the_blank);
    ProgressManager.updateProgress();
  };

  return { render, shuffle, reset };
})();

// ========================================
// 8. PYODIDE RUNTIME — In-browser Python
// ========================================
const PythonRuntime = (() => {
  // === Virtual File Catalog — Dataset Definitions ===
  const DATASETS = [
    {
      id: 'students',
      name: 'students.csv',
      path: '/data/students.csv',
      description: 'Student records with scores and classes',
      columns: ['id', 'name', 'score', 'age', 'class'],
      rows: 5,
      usage: 'pd.read_csv("/data/students.csv")',
      content: `id,name,score,age,class
1,Ahmed,85,20,A
2,Sara,90,22,B
3,John,75,19,A
4,Mary,88,21,C
5,Ali,92,23,B`
    },
    {
      id: 'sales',
      name: 'sales.csv',
      path: '/data/sales.csv',
      description: 'Product sales with quantity and price',
      columns: ['id', 'product', 'quantity', 'price'],
      rows: 4,
      usage: 'pd.read_csv("/data/sales.csv")',
      content: `id,product,quantity,price
1,Laptop,2,1200
2,Mouse,10,25
3,Keyboard,5,45
4,Monitor,3,300`
    },
    {
      id: 'weather',
      name: 'weather.csv',
      path: '/data/weather.csv',
      description: 'Daily temperature and humidity readings',
      columns: ['day', 'temp', 'humidity', 'city'],
      rows: 4,
      usage: 'pd.read_csv("/data/weather.csv")',
      content: `day,temp,humidity,city
Mon,30,70,Cairo
Tue,32,65,Cairo
Wed,28,60,Cairo
Thu,31,72,Cairo`
    },
    {
      id: 'users',
      name: 'users.csv',
      path: '/data/users.csv',
      description: 'User profiles with activity metrics',
      columns: ['id', 'username', 'posts', 'followers'],
      rows: 5,
      usage: 'pd.read_csv("/data/users.csv")',
      content: `id,username,posts,followers
1,ahmed_dev,42,350
2,sara_data,67,890
3,john_ml,23,120
4,mary_code,55,670
5,ali_web,38,410`
    },
    {
      id: 'products',
      name: 'products.csv',
      path: '/data/products.csv',
      description: 'Product inventory with categories and ratings',
      columns: ['id', 'product', 'category', 'price', 'rating'],
      rows: 6,
      usage: 'pd.read_csv("/data/products.csv")',
      content: `id,product,category,price,rating
1,Phone A,Electronics,699,4.5
2,Book B,Books,15,4.8
3,Shoes C,Clothing,89,4.2
4,Desk D,Furniture,250,4.0
5,Headset E,Electronics,120,4.6
6,Jacket F,Clothing,65,3.9`
    }
  ];

  // Legacy backward-compat alias
  const LEGACY_CSV_PATH = 'data.csv';

  let pyodide = null;
  let loading = false;
  let loaded = false;
  let loadError = null;
  let progressText = '';
  let filesInjected = false;

  // Callbacks for UI updates
  const listeners = [];
  const notify = () => listeners.forEach(fn => fn(getStatus()));

  const getStatus = () => ({ loading, loaded, error: loadError, progressText });

  const onStatus = (fn) => {
    listeners.push(fn);
    fn(getStatus());
  };

  /** Load Pyodide and packages (called once at startup) */
  const init = async () => {
    if (loaded || loading) return;
    loading = true;
    loadError = null;
    progressText = 'Loading Python runtime...';
    notify();

    try {
      const { loadPyodide } = await import('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.mjs');

      progressText = 'Starting Python engine...';
      notify();

      pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/'
      });

      progressText = 'Loading pandas & numpy...';
      notify();

      await pyodide.loadPackage(['pandas', 'numpy', 'matplotlib']);

      // Create /data/ directory and inject all files
      injectAllFiles();

      loaded = true;
      loading = false;
      progressText = 'Python ready!';
      notify();

      console.log('[ExamBank] Pyodide loaded successfully. Files:', DATASETS.map(d => d.path));
    } catch (err) {
      loading = false;
      loadError = err.message;
      progressText = 'Failed to load Python';
      notify();
      console.error('[ExamBank] Pyodide load error:', err);
    }
  };

  /** Create /data/ directory and inject all dataset files */
  const injectAllFiles = () => {
    if (!pyodide) return;
    try { pyodide.FS.mkdir('/data'); } catch (e) { /* already exists */ }

    for (const dataset of DATASETS) {
      try {
        pyodide.FS.writeFile(dataset.path, dataset.content);
      } catch (e) {
        console.warn(`[ExamBank] Failed to write ${dataset.path}:`, e);
      }
    }

    // Also write legacy data.csv (alias to students) for backward compat
    try { pyodide.FS.writeFile(LEGACY_CSV_PATH, DATASETS[0].content); } catch (e) { /* ignore */ }

    filesInjected = true;
  };

  /** Run Python code, returns { stdout, error } */
  const run = async (code) => {
    if (!pyodide) {
      return { error: 'Python runtime not loaded. ' + (loadError || 'Still loading...') };
    }

    // Ensure files are available (re-inject if needed)
    if (!filesInjected) {
      injectAllFiles();
    }

    // Redirect stdout/stderr
    pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

    try {
      await pyodide.runPythonAsync(code);

      const stdout = pyodide.runPython('sys.stdout.getvalue()');
      const stderr = pyodide.runPython('sys.stderr.getvalue()');

      // Reset streams
      pyodide.runPython(`
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

      let output = '';
      if (stdout) output += stdout;
      if (stderr) output += (output ? '\n' : '') + stderr;

      return { stdout: output || '(no output)', error: null };
    } catch (err) {
      let partialOut = '';
      try { partialOut = pyodide.runPython('sys.stdout.getvalue()'); } catch (e) { /* ignore */ }

      pyodide.runPython(`
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

      const error = err.message || String(err);
      return { stdout: partialOut || null, error };
    }
  };

  /** Get dataset catalog */
  const getCatalog = () => [...DATASETS];

  /** Get a specific dataset by ID */
  const getDataset = (id) => DATASETS.find(d => d.id === id) || null;

  /** Check if ready */
  const isReady = () => loaded;

  return { init, run, onStatus, isReady, getCatalog, getDataset, getStatus };
})();

// ========================================
// 8b. ERROR PARSER — IDE-like error display
// ========================================
const ErrorParser = (() => {
  /**
   * Parse a Python traceback string into structured error info.
   * Returns { type, message, line, filename, frames[] } or null.
   */
  const parsePythonTraceback = (traceback) => {
    if (!traceback) return null;

    const lines = traceback.split('\n');
    const frames = [];
    let errorType = 'Error';
    let errorMessage = '';
    let errorLine = null;

    // Find the actual error line (last non-empty line that isn't a frame)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line && !line.startsWith('File ') && !line.startsWith('^')) {
        // This is the error type + message: "KeyError: 'column_name'"
        const match = line.match(/^(\w+Error|\w+Exception|\w+):\s*(.*)/);
        if (match) {
          errorType = match[1];
          errorMessage = match[2].trim();
        } else {
          errorMessage = line;
        }
        break;
      }
    }

    // Extract frames: File "...", line N, in ...
    const frameRegex = /^File "([^"]+)", line (\d+)(?:, in (\S+))?/;
    for (const line of lines) {
      const match = line.match(frameRegex);
      if (match) {
        frames.push({
          filename: match[1],
          line: parseInt(match[2], 10),
          function: match[3] || '<module>'
        });
      }
    }

    // Find the user's error line (last frame, typically in <exec> or user file)
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i].filename === '<exec>' || !frames[i].filename.includes('/lib/')) {
        errorLine = frames[i].line;
        break;
      }
    }

    // Fallback: last frame
    if (errorLine === null && frames.length > 0) {
      errorLine = frames[frames.length - 1].line;
    }

    return {
      type: errorType,
      message: errorMessage,
      line: errorLine,
      frames,
      raw: traceback
    };
  };

  /** Parse JavaScript error */
  const parseJSError = (err) => {
    if (!err) return null;
    return {
      type: err.name || 'Error',
      message: err.message || String(err),
      line: err.lineNumber || null,
      raw: err.stack || err.message
    };
  };

  return { parsePythonTraceback, parseJSError };
})();

// ========================================
// 8c. FILE CATALOG UI — VS Code Explorer Panel
// ========================================
const FileCatalog = (() => {
  let panelEl = null;
  let isVisible = false;

  /** Build the catalog panel HTML */
  const buildPanel = () => {
    const datasets = PythonRuntime.getCatalog();
    const status = PythonRuntime.getStatus();
    const isLoading = status.loading;
    const isLoaded = status.loaded;

    let html = '<div class="catalog-panel">';

    // Panel header
    html += '<div class="catalog-header">';
    html += '<div class="catalog-header-left">';
    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
    html += '<span class="catalog-title">Dataset Catalog</span>';
    html += '</div>';
    html += '<button class="catalog-close" aria-label="Close catalog">&times;</button>';
    html += '</div>';

    // Panel body
    html += '<div class="catalog-body">';

    if (isLoading) {
      html += '<div class="catalog-loading"><div class="catalog-spinner"></div><span>Loading datasets...</span></div>';
    } else if (!isLoaded) {
      html += '<div class="catalog-empty"><p>Python runtime not available.</p><p>Try refreshing the page.</p></div>';
    } else {
      // Directory tree header
      html += '<div class="catalog-tree-header">';
      html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
      html += '<span>/data/</span>';
      html += '</div>';

      html += '<div class="catalog-file-list">';
      for (const ds of datasets) {
        html += `<div class="catalog-file-item" data-file="${ds.id}">`;
        html += `<div class="file-icon">`;
        html += `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
        html += `</div>`;
        html += `<div class="file-info">`;
        html += `<div class="file-name">${ds.name}</div>`;
        html += `<div class="file-stats">`;
        html += `<span class="stat-badge stat-rows">${ds.rows} rows</span>`;
        html += `<span class="stat-badge stat-cols">${ds.columns.length} columns</span>`;
        html += `</div>`;
        html += `<div class="file-columns">`;
        html += `<span class="columns-label">Columns:</span>`;
        html += ds.columns.map(col => `<code class="column-badge">${col}</code>`).join(' ');
        html += `</div>`;
        html += `<div class="file-usage">`;
        html += `<code class="usage-code">${ds.usage}</code>`;
        html += `<button class="file-copy-btn" title="Copy path to clipboard" data-path="${ds.path}">`;
        html += `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        html += `</button>`;
        html += `</div>`;
        html += `</div>`;
        html += `</div>`;
      }
      html += '</div>';

      // Hint
      html += '<div class="catalog-hint">';
      html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
      html += '<span>Click "Copy path" then paste into <code>pd.read_csv()</code></span>';
      html += '</div>';
    }

    html += '</div>'; // catalog-body
    html += '</div>'; // catalog-panel
    return html;
  };

  /** Show the catalog panel */
  const show = () => {
    if (panelEl) {
      // Already open, bring to front
      panelEl.classList.remove('closing');
      return;
    }

    // Build and insert
    const container = document.createElement('div');
    container.className = 'catalog-overlay';
    container.innerHTML = buildPanel();
    document.body.appendChild(container);
    panelEl = container.querySelector('.catalog-panel');
    isVisible = true;

    // Bind events
    bindEvents(container);
  };

  /** Hide the catalog panel */
  const hide = () => {
    if (!panelEl) {
      isVisible = false;
      return;
    }
    panelEl.classList.add('closing');
    isVisible = false;
    setTimeout(() => {
      if (panelEl && panelEl.parentElement) {
        panelEl.parentElement.remove();
      }
      panelEl = null;
    }, 200);
  };

  /** Toggle the catalog panel */
  const toggle = () => {
    isVisible ? hide() : show();
  };

  /** Check if visible */
  const isOpen = () => isVisible;

  /** Bind panel events */
  const bindEvents = (container) => {
    // Close button
    container.querySelector('.catalog-close')?.addEventListener('click', hide);

    // Click overlay to close
    container.addEventListener('click', (e) => {
      if (e.target === container) hide();
    });

    // Copy path buttons
    container.querySelectorAll('.file-copy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const path = btn.dataset.path;
        try {
          await navigator.clipboard.writeText(path);
        } catch (err) {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = path;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        // Visual feedback
        btn.classList.add('copied');
        btn.title = 'Copied!';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.title = 'Copy path to clipboard';
        }, 1500);
      });
    });
  };

  /** Refresh panel content (e.g., after loading completes) */
  const refresh = () => {
    if (!panelEl || !panelEl.parentElement) return;
    const container = panelEl.parentElement;
    panelEl.classList.remove('closing');
    container.innerHTML = buildPanel();
    panelEl = container.querySelector('.catalog-panel');
    bindEvents(container);
  };

  return { show, hide, toggle, isOpen, refresh };
})();

// ========================================
// 9. CODE MODULE
// ========================================
const CodeModule = (() => {
  /**
   * Build a VS Code-like code card with:
   *  - Highlighted read-only display (default view)
   *  - "Try it yourself" toggle → reveals editable textarea
   *  - Live output panel with Python (Pyodide) + JS execution
   *  - Reset button
   *  - Runtime loading indicator
   */
  const render = (questions) => {
    const container = document.getElementById('codeQuestions');
    container.innerHTML = '';

    questions.forEach((q, index) => {
      const state = AppState.get();
      const isArabic = state.preferences.language === 'ar';
      const lang = detectLanguage(q.code);
      const { html, lineCount } = SyntaxHighlighter.highlight(q.code);
      const lineNumbersHtml = buildLineNumbers(lineCount);

      const card = document.createElement('div');
      card.className = 'code-card';
      card.id = `code-${q.id}`;
      card.innerHTML = `
        <!-- Task Description -->
        <div class="code-task">
          <span class="code-task-label">${isArabic ? 'المهمة' : 'Task'} ${index + 1}</span>
          <p class="code-task-text">${Utils.highlightKeywords(Utils.escapeHtml(q.task))}</p>
        </div>

        <!-- Highlighted Code Display (default visible) -->
        <div class="code-display-panel" data-mode="display">
          <div class="code-panel-header">
            <div class="code-panel-dots">
              <span class="dot dot-red"></span>
              <span class="dot dot-yellow"></span>
              <span class="dot dot-green"></span>
            </div>
            <span class="code-lang-label">${lang}</span>
            <button class="code-action-btn try-it-btn" title="Edit and run this code">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              ${isArabic ? 'جرّب بنفسك' : 'Try it yourself'}
            </button>
          </div>
          <div class="code-display-body">
            <div class="code-line-numbers">${lineNumbersHtml}</div>
            <pre class="code-highlighted">${html}</pre>
          </div>
        </div>

        <!-- Editable Editor (hidden by default) -->
        <div class="code-editor-panel" data-mode="editor" style="display:none">
          <div class="code-panel-header">
            <div class="code-panel-dots">
              <span class="dot dot-red"></span>
              <span class="dot dot-yellow"></span>
              <span class="dot dot-green"></span>
            </div>
            <span class="code-lang-label">${lang}</span>
            <div class="code-panel-actions">
              <button class="code-action-btn reset-code-btn" title="Reset to original">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                ${isArabic ? 'إعادة' : 'Reset'}
              </button>
              <button class="code-action-btn run-code-btn" title="Run code">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                ${isArabic ? 'تشغيل' : 'Run'}
              </button>
            </div>
          </div>
          <div class="code-editor-body">
            <div class="code-line-numbers">${lineNumbersHtml}</div>
            <textarea class="code-textarea" spellcheck="false" data-original="${Utils.escapeHtml(q.code)}" aria-label="Code editor">${Utils.escapeHtml(q.code)}</textarea>
          </div>
        </div>

        <!-- Output Panel -->
        <div class="code-output-panel">
          <div class="output-header">
            <span class="output-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
              ${isArabic ? 'المخرجات' : 'Output'}
            </span>
            <button class="code-action-btn clear-output-btn" title="Clear output">
              ${isArabic ? 'مسح' : 'Clear'}
            </button>
          </div>
          <div class="code-output">
            <span class="output-placeholder">${isArabic ? 'اضغط على تشغيل لرؤية المخرجات' : 'Press Run to see output'}</span>
          </div>
          <!-- Runtime loading indicator -->
          <div class="runtime-status" style="display:none">
            <div class="runtime-spinner"></div>
            <span class="runtime-text">Loading Python...</span>
          </div>
        </div>
      `;

      container.appendChild(card);
      bindCardEvents(card, q, isArabic, lang);

      // Mark as viewed
      if (!AppState.getProgress('code')[q.id]) {
        AppState.setProgress('code', q.id, { viewed: true, correct: true });
        ProgressManager.updateProgress();
      }
    });

    // Initialize keyword tooltips
    Utils.initKeywordTooltips(container);
  };

  /** Detect language from code content */
  const detectLanguage = (code) => {
    if (/import\s+pandas|import\s+matplotlib|import\s+seaborn|import\s+numpy|def\s+\w+|print\(|plt\./i.test(code)) return 'Python';
    if (/console\.|document\.|let\s+|const\s+|var\s+|function\s+|=>|alert\(/i.test(code)) return 'JavaScript';
    return 'Code';
  };

  /** Generate line numbers HTML */
  const buildLineNumbers = (count) => {
    let html = '';
    for (let i = 1; i <= count; i++) {
      html += `${i}\n`;
    }
    return html;
  };

  /** Bind all event listeners for a card */
  const bindCardEvents = (card, question, isArabic, lang) => {
    const tryItBtn = card.querySelector('.try-it-btn');
    const displayPanel = card.querySelector('.code-display-panel');
    const editorPanel = card.querySelector('.code-editor-panel');
    const textarea = card.querySelector('.code-textarea');
    const editorLineNums = editorPanel.querySelector('.code-line-numbers');
    const runBtn = card.querySelector('.run-code-btn');
    const resetBtn = card.querySelector('.reset-code-btn');
    const outputEl = card.querySelector('.code-output');
    const clearBtn = card.querySelector('.clear-output-btn');
    const runtimeStatus = card.querySelector('.runtime-status');
    const runtimeText = card.querySelector('.runtime-text');
    const runtimeSpinner = card.querySelector('.runtime-spinner');

    // --- Toggle editor view ---
    tryItBtn.addEventListener('click', () => {
      const isEditorVisible = editorPanel.style.display !== 'none';
      if (isEditorVisible) {
        editorPanel.style.display = 'none';
        displayPanel.style.display = '';
      } else {
        displayPanel.style.display = 'none';
        editorPanel.style.display = '';
        setTimeout(() => textarea.focus(), 50);
      }
    });

    // --- Sync line numbers ---
    const updateLineNumbers = () => {
      const lines = textarea.value.split('\n').length;
      let nums = '';
      for (let i = 1; i <= lines; i++) nums += `${i}\n`;
      editorLineNums.textContent = nums;
    };

    textarea.addEventListener('input', updateLineNumbers);
    textarea.addEventListener('scroll', () => {
      editorLineNums.scrollTop = textarea.scrollTop;
    });

    // Tab key → 4 spaces
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 4;
        updateLineNumbers();
      }
    });

    // --- Set run button state based on Python runtime ---
    const updateRunButton = () => {
      const status = PythonRuntime.getStatus();
      if (lang === 'Python' && (status.loading || status.error)) {
        runBtn.disabled = true;
        runBtn.style.opacity = '0.5';
        runBtn.style.cursor = status.loading ? 'wait' : 'not-allowed';
      } else {
        runBtn.disabled = false;
        runBtn.style.opacity = '';
        runBtn.style.cursor = '';
      }
    };

    PythonRuntime.onStatus(updateRunButton);

    // --- Run code ---
    runBtn.addEventListener('click', async () => {
      const code = textarea.value;
      outputEl.classList.remove('error');
      outputEl.classList.remove('success');
      clearEditorError(editorPanel);

      // --- JavaScript execution ---
      if (lang === 'JavaScript') {
        executeJS(code, outputEl, isArabic);
        return;
      }

      // --- Python execution via Pyodide ---
      const status = PythonRuntime.getStatus();

      if (status.error) {
        outputEl.classList.add('error');
        outputEl.innerHTML = `<span class="output-note">⚠️ Failed to load Python engine: ${status.error}</span>`;
        return;
      }

      if (status.loading) {
        outputEl.innerHTML = `<span class="output-note">⏳ Python is still loading... please wait.</span>`;
        return;
      }

      // Show loading state
      showLoading(runtimeStatus, runtimeText, runtimeSpinner, isArabic);
      runBtn.disabled = true;

      try {
        const result = await PythonRuntime.run(code);

        hideLoading(runtimeStatus);

        if (result.error) {
          outputEl.classList.add('error');
          const parsedError = ErrorParser.parsePythonTraceback(result.error);

          // Show clean error panel in output
          outputEl.innerHTML = buildErrorHtml(parsedError, result.stdout);

          // Highlight error line in editor
          if (parsedError && parsedError.line) {
            highlightErrorLine(editorPanel, parsedError.line, textarea);
          }
        } else {
          outputEl.textContent = result.stdout;
          outputEl.classList.add('success');
        }
      } catch (err) {
        hideLoading(runtimeStatus);
        outputEl.classList.add('error');
        const parsedError = ErrorParser.parseJSError(err);
        outputEl.innerHTML = buildErrorHtml(parsedError, null);
      } finally {
        runBtn.disabled = false;
      }
    });

    // --- Reset code ---
    resetBtn.addEventListener('click', () => {
      textarea.value = textarea.dataset.original;
      updateLineNumbers();
      outputEl.innerHTML = '<span class="output-placeholder">' + (isArabic ? 'اضغط على تشغيل لرؤية المخرجات' : 'Press Run to see output') + '</span>';
      outputEl.classList.remove('error', 'success');
      hideLoading(runtimeStatus);
    });

    // --- Clear output ---
    clearBtn.addEventListener('click', () => {
      outputEl.innerHTML = '<span class="output-placeholder">' + (isArabic ? 'اضغط على تشغيل لرؤية المخرجات' : 'Press Run to see output') + '</span>';
      outputEl.classList.remove('error', 'success');
      hideLoading(runtimeStatus);
    });
  };

  /** Show runtime loading indicator */
  const showLoading = (el, textEl, spinnerEl, isArabic) => {
    el.style.display = 'flex';
    textEl.textContent = isArabic ? 'جاري تشغيل بايثون...' : 'Running Python...';

    // Listen for status updates from Pyodide
    const listener = (status) => {
      textEl.textContent = status.progressText || (isArabic ? 'جاري التحميل...' : 'Loading...');
    };
    PythonRuntime.onStatus(listener);
    el._statusListener = listener;
  };

  /** Hide runtime loading indicator */
  const hideLoading = (el) => {
    el.style.display = 'none';
  };

  /** Build IDE-style error HTML for the output panel */
  const buildErrorHtml = (parsedError, partialOutput) => {
    if (!parsedError) return `<pre class="error-raw">${Utils.escapeHtml(partialOutput || 'Unknown error')}</pre>`;

    let html = '<div class="error-panel">';

    // Error header with icon
    html += `<div class="error-header">`;
    html += `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    html += `<span class="error-type">${Utils.escapeHtml(parsedError.type)}</span>`;
    if (parsedError.line) {
      html += `<span class="error-location">Line ${parsedError.line}</span>`;
    }
    html += `</div>`;

    // Error message
    if (parsedError.message) {
      html += `<div class="error-message">${Utils.escapeHtml(parsedError.message)}</div>`;
    }

    // Partial stdout before error
    if (partialOutput) {
      html += `<div class="error-output-label">Output before error:</div>`;
      html += `<pre class="error-partial-output">${Utils.escapeHtml(partialOutput)}</pre>`;
    }

    // Stack frames (only user-relevant ones, max 3)
    const userFrames = (parsedError.frames || [])
      .filter(f => f.filename === '<exec>' || !f.filename.includes('/lib/'))
      .slice(-3);

    if (userFrames.length > 0) {
      html += `<div class="error-stack">`;
      html += `<div class="error-stack-label">Stack:</div>`;
      for (const frame of userFrames) {
        html += `<div class="error-frame">`;
        html += `<span class="error-frame-fn">${Utils.escapeHtml(frame.function)}</span>`;
        html += `<span class="error-frame-file">${Utils.escapeHtml(frame.filename)}</span>`;
        html += `<span class="error-frame-line">:${frame.line}</span>`;
        html += `</div>`;
      }
      html += `</div>`;
    }

    // Full traceback toggle
    html += `<button class="error-toggle" onclick="this.nextElementSibling.classList.toggle('show'); this.textContent = this.nextElementSibling.classList.contains('show') ? 'Hide traceback' : 'Show full traceback';">Show full traceback</button>`;
    html += `<pre class="error-traceback">${Utils.escapeHtml(parsedError.raw)}</pre>`;

    html += '</div>';
    return html;
  };

  /** Highlight the error line in the editor */
  const highlightErrorLine = (editorPanel, lineNumber, textarea) => {
    // Remove any existing error marker
    clearEditorError(editorPanel);

    const lines = textarea.value.split('\n');
    if (lineNumber < 1 || lineNumber > lines.length) return;

    const errorLineIndex = lineNumber - 1;

    // Calculate pixel position based on line height
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computedStyle.lineHeight) || (13 * 1.7);
    const paddingTop = parseFloat(computedStyle.paddingTop) || 16;
    const topOffset = paddingTop + errorLineIndex * lineHeight;

    // Add error marker overlay in the editor
    const overlay = document.createElement('div');
    overlay.className = 'error-line-marker';
    overlay.setAttribute('data-line', lineNumber);

    const gutterDot = document.createElement('div');
    gutterDot.className = 'error-gutter-dot';
    gutterDot.style.top = `${topOffset + 4}px`; // +4 for visual centering in line

    const lineHighlight = document.createElement('div');
    lineHighlight.className = 'error-line-highlight';
    lineHighlight.style.top = `${topOffset}px`;
    lineHighlight.style.height = `${lineHeight}px`;

    overlay.appendChild(gutterDot);
    overlay.appendChild(lineHighlight);
    editorPanel.appendChild(overlay);

    // Scroll to the error line
    const editorBody = editorPanel.querySelector('.code-editor-body');
    if (editorBody) {
      editorBody.scrollTop = Math.max(0, topOffset - 60);
    }

    editorPanel.classList.add('has-error');
  };

  /** Clear error markers from the editor */
  const clearEditorError = (editorPanel) => {
    editorPanel.classList.remove('has-error');
    const marker = editorPanel.querySelector('.error-line-marker');
    if (marker) marker.remove();
  };

  /** Execute JavaScript safely */
  const executeJS = (code, outputEl, isArabic) => {
    try {
      const logs = [];
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      console.log = (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
      console.warn = (...args) => logs.push('⚠ ' + args.join(' '));
      console.error = (...args) => logs.push('✗ ' + args.join(' '));

      const sandboxed = new Function(code);
      const result = sandboxed();

      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;

      if (result !== undefined) {
        logs.push(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
      }

      if (logs.length > 0) {
        outputEl.textContent = logs.join('\n');
        outputEl.classList.add('success');
      } else {
        outputEl.innerHTML = '<span class="output-placeholder">(completed — no output)</span>';
      }
    } catch (err) {
      outputEl.classList.add('error');
      outputEl.textContent = `✗ ${err.name}: ${err.message}`;
    }
  };

  return { render };
})();

// ========================================
// 9. THEME & LANGUAGE MANAGER
// ========================================
const UIManager = (() => {
  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    AppState.setPreference('theme', theme);
  };

  const applyLanguage = (lang) => {
    document.documentElement.setAttribute('data-lang', lang);
    AppState.setPreference('language', lang);

    // Update all translatable elements
    document.querySelectorAll('[data-en][data-ar]').forEach(el => {
      el.textContent = lang === 'ar' ? el.dataset.ar : el.dataset.en;
    });

    // Update language label
    const langLabel = document.getElementById('langLabel');
    if (langLabel) langLabel.textContent = lang === 'ar' ? 'AR' : 'EN';

    // Re-render current category to update question text
    const state = AppState.get();
    NavigationManager.renderCategory(state.currentCategory);
  };

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  };

  const toggleLanguage = () => {
    const current = document.documentElement.getAttribute('data-lang');
    applyLanguage(current === 'ar' ? 'en' : 'ar');
  };

  return { applyTheme, applyLanguage, toggleTheme, toggleLanguage };
})();

// ========================================
// 10. NAVIGATION & ROUTER
// ========================================
const NavigationManager = (() => {
  const switchCategory = (category) => {
    const state = AppState.get();
    state.currentCategory = category;

    // Update tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.category === category);
    });

    // Hide all sections
    document.querySelectorAll('.question-section').forEach(section => {
      section.classList.add('hidden');
    });

    // Show selected section
    const sectionMap = {
      true_false: 'trueFalseSection',
      mcq: 'mcqSection',
      short_answer: 'shortAnswerSection',
      code: 'codeSection',
      fill_in_the_blank: 'fibSection'
    };

    const sectionId = sectionMap[category];
    if (sectionId) {
      document.getElementById(sectionId).classList.remove('hidden');
    }
  };

  const renderCategory = (category) => {
    const state = AppState.get();
    const questions = state.questions[category];

    switch (category) {
      case 'true_false':
        TrueFalseModule.render(questions);
        break;
      case 'mcq':
        MCQModule.render(questions);
        break;
      case 'short_answer':
        ShortAnswerModule.render(questions);
        break;
      case 'code':
        CodeModule.render(questions);
        break;
      case 'fill_in_the_blank':
        FillInTheBlankModule.render(questions);
        break;
    }

    ProgressManager.updateProgress();
  };

  return { switchCategory, renderCategory };
})();

// ========================================
// 11. KEYBOARD SHORTCUTS
// ========================================
const KeyboardManager = (() => {
  const shortcutsVisible = () => !document.getElementById('shortcutsModal').classList.contains('hidden');

  const handleKeyDown = (e) => {
    // Don't handle if typing in textarea/input
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    // Don't handle if modal is open
    const dashboardOpen = !document.getElementById('dashboardModal').classList.contains('hidden');

    // ? - Toggle shortcuts
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      const modal = document.getElementById('shortcutsModal');
      modal.classList.toggle('hidden');
      return;
    }

    if (shortcutsVisible()) return;

    // D - Toggle dark mode
    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      UIManager.toggleTheme();
      return;
    }

    const state = AppState.get();
    const category = state.currentCategory;

    if (category === 'true_false') {
      const unanswered = document.querySelectorAll('#tfQuestions .tf-btn:not(:disabled)');
      if (unanswered.length === 0) return;

      if (e.key === '1') {
        e.preventDefault();
        const trueBtn = document.querySelector('#tfQuestions .tf-btn[data-answer="true"]:not(:disabled)');
        trueBtn?.click();
      } else if (e.key === '2') {
        e.preventDefault();
        const falseBtn = document.querySelector('#tfQuestions .tf-btn[data-answer="false"]:not(:disabled)');
        falseBtn?.click();
      }
    }

    if (category === 'mcq') {
      const optionKeys = ['1', '2', '3', '4'];
      if (optionKeys.includes(e.key)) {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const options = document.querySelectorAll('#mcqQuestions .mcq-option:not(:disabled)');
        // Find first question's options
        const firstQuestion = document.querySelector('#mcqQuestions .question-card');
        if (firstQuestion) {
          const questionOptions = firstQuestion.querySelectorAll('.mcq-option:not(:disabled)');
          if (questionOptions[index]) {
            questionOptions[index].click();
          }
        }
      }
    }
  };

  const init = () => {
    document.addEventListener('keydown', handleKeyDown);
  };

  return { init };
})();

// ========================================
// 12. DATA LOADER
// ========================================
const DataLoader = (() => {
  const load = async () => {
    try {
      const response = await fetch('questions.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to load questions.json:', error);
      // Fallback: display error message
      document.querySelector('.main-content').innerHTML = `
        <div class="question-card" style="text-align:center; padding: 3rem;">
          <h2 style="color: var(--color-error); margin-bottom: 1rem;">Failed to load questions</h2>
          <p style="color: var(--color-text-secondary); margin-bottom: 1.5rem;">
            Make sure <code>questions.json</code> is in the same directory as this file.
          </p>
          <p style="color: var(--color-text-tertiary); font-size: 0.875rem;">${error.message}</p>
        </div>
      `;
      return null;
    }
  };

  return { load };
})();

// ========================================
// 13. APP INITIALIZATION
// ========================================
const App = (() => {
  const init = async () => {
    // Load keywords first
    await KeywordManager.load();

    // Load preferences
    AppState.loadFromStorage();

    // Load questions data
    const data = await DataLoader.load();
    if (!data) return;

    // Set questions
    const state = AppState.get();
    state.questions.true_false = data.true_false || [];
    state.questions.mcq = data.mcq || [];
    state.questions.short_answer = data.short_answer || [];
    state.questions.code = data.code || [];
    state.questions.fill_in_the_blank = data.fill_in_the_blank || [];

    // Update counts
    document.getElementById('tfCount').textContent = state.questions.true_false.length;
    document.getElementById('mcqCount').textContent = state.questions.mcq.length;
    document.getElementById('saCount').textContent = state.questions.short_answer.length;
    document.getElementById('codeCount').textContent = state.questions.code.length;
    document.getElementById('fibCount').textContent = state.questions.fill_in_the_blank.length;

    // Apply saved preferences
    UIManager.applyTheme(state.preferences.theme);
    UIManager.applyLanguage(state.preferences.language);

    // Render initial category
    NavigationManager.renderCategory(state.currentCategory);
    ProgressManager.updateProgress();

    // Start loading Pyodide Python runtime in background
    PythonRuntime.init();

    // Set up event listeners
    setupEventListeners();

    // Initialize keyboard shortcuts
    KeyboardManager.init();
  };

  const setupEventListeners = () => {
    // Category navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        NavigationManager.switchCategory(tab.dataset.category);
        NavigationManager.renderCategory(tab.dataset.category);
      });
    });

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', UIManager.toggleTheme);

    // Language toggle
    document.getElementById('langToggle').addEventListener('click', UIManager.toggleLanguage);

    // Dashboard
    document.getElementById('dashboardBtn').addEventListener('click', () => {
      document.getElementById('dashboardModal').classList.remove('hidden');
      ProgressManager.updateProgress();
    });

    // Dataset Catalog
    const catalogBtn = document.getElementById('catalogBtn');
    if (catalogBtn) {
      catalogBtn.addEventListener('click', () => {
        try {
          FileCatalog.toggle();
        } catch (err) {
          console.error('[ExamBank] Catalog error:', err);
        }
      });
    } else {
      console.warn('[ExamBank] catalogBtn not found in DOM');
    }

    document.getElementById('modalClose').addEventListener('click', () => {
      document.getElementById('dashboardModal').classList.add('hidden');
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.add('hidden');
        }
      });
    });

    // Keyboard shortcuts modal
    document.getElementById('shortcutsBtn').addEventListener('click', () => {
      document.getElementById('shortcutsModal').classList.remove('hidden');
    });

    document.getElementById('shortcutsClose').addEventListener('click', () => {
      document.getElementById('shortcutsModal').classList.add('hidden');
    });

    // True/False controls
    document.getElementById('tfShuffleBtn').addEventListener('click', TrueFalseModule.shuffle);
    document.getElementById('tfResetBtn').addEventListener('click', TrueFalseModule.reset);

    // MCQ controls
    document.getElementById('mcqShuffleBtn').addEventListener('click', MCQModule.shuffle);
    document.getElementById('mcqResetBtn').addEventListener('click', MCQModule.reset);

    // Short Answer controls
    document.getElementById('saShuffleBtn').addEventListener('click', ShortAnswerModule.shuffle);

    // Fill in the Blank controls
    document.getElementById('fibShuffleBtn').addEventListener('click', FillInTheBlankModule.shuffle);
    document.getElementById('fibResetBtn').addEventListener('click', FillInTheBlankModule.reset);

    // Code Help Button
    const codeHelpBtn = document.getElementById('codeHelpBtn');
    const codeHelpTooltip = document.getElementById('codeHelpTooltip');
    const tooltipClose = document.getElementById('tooltipClose');

    if (codeHelpBtn && codeHelpTooltip) {
      codeHelpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        codeHelpTooltip.classList.toggle('hidden');
      });

      // Close tooltip
      if (tooltipClose) {
        tooltipClose.addEventListener('click', () => {
          codeHelpTooltip.classList.add('hidden');
        });
      }

      // Close tooltip when clicking outside
      document.addEventListener('click', (e) => {
        if (!codeHelpTooltip.contains(e.target) && !codeHelpBtn.contains(e.target)) {
          codeHelpTooltip.classList.add('hidden');
        }
      });
    }
  };

  return { init };
})();

// ========================================
// START APP
// ========================================
document.addEventListener('DOMContentLoaded', App.init);
