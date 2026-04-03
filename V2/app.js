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
      code: []
    },
    currentCategory: 'true_false',
    progress: {
      true_false: {},
      mcq: {},
      short_answer: {},
      code: {}
    },
    preferences: {
      theme: 'light',
      language: 'en'
    }
  };

  const get = () => data;
  
  const setProgress = (category, questionId, result) => {
    data.progress[category][questionId] = result;
    saveToStorage();
  };

  const getProgress = (category) => data.progress[category];

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
// 2. UTILITY FUNCTIONS
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
  }
};

// ========================================
// 3. SYNTAX HIGHLIGHTER (VS Code-like)
// ========================================
const SyntaxHighlighter = (() => {
  const keywords = new Set([
    'import', 'from', 'def', 'class', 'return', 'if', 'else', 'elif', 'for', 'while',
    'in', 'not', 'and', 'or', 'is', 'True', 'False', 'None', 'try', 'except', 'finally',
    'with', 'as', 'pass', 'break', 'continue', 'lambda', 'yield', 'global', 'nonlocal',
    'assert', 'raise', 'del', 'print'
  ]);

  const builtins = new Set([
    'pd', 'plt', 'sns', 'np', 'print', 'len', 'range', 'int', 'str', 'float', 'list',
    'dict', 'set', 'tuple', 'type', 'isinstance', 'enumerate', 'zip', 'map', 'filter',
    'sorted', 'reversed', 'sum', 'min', 'max', 'abs', 'open', 'read_csv', 'show',
    'hist', 'boxplot', 'heatmap', 'corr', 'mean', 'median', 'std'
  ]);

  const tokenize = (code) => {
    const lines = code.split('\n');
    return lines.map(line => {
      let result = '';
      let i = 0;
      let inString = false;
      let stringChar = '';
      let inComment = false;
      let currentToken = '';
      let currentType = 'text';

      const flushToken = () => {
        if (currentToken) {
          const escaped = Utils.escapeHtml(currentToken);
          if (currentType === 'keyword') {
            result += `<span class="token-keyword">${escaped}</span>`;
          } else if (currentType === 'string') {
            result += `<span class="token-string">${escaped}</span>`;
          } else if (currentType === 'comment') {
            result += `<span class="token-comment">${escaped}</span>`;
          } else if (currentType === 'number') {
            result += `<span class="token-number">${escaped}</span>`;
          } else if (currentType === 'function') {
            result += `<span class="token-function">${escaped}</span>`;
          } else if (currentType === 'builtin') {
            result += `<span class="token-builtin">${escaped}</span>`;
          } else if (currentType === 'operator') {
            result += `<span class="token-operator">${escaped}</span>`;
          } else {
            result += escaped;
          }
          currentToken = '';
          currentType = 'text';
        }
      };

      while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1] || '';

        // Comment
        if (!inString && char === '#') {
          flushToken();
          inComment = true;
          currentToken = line.substring(i);
          currentType = 'comment';
          break;
        }

        // String
        if (!inComment && !inString && (char === "'" || char === '"')) {
          // Check for triple quote
          if (line.substring(i, i + 3) === char.repeat(3)) {
            flushToken();
            const endIdx = line.indexOf(char.repeat(3), i + 3);
            if (endIdx !== -1) {
              currentToken = line.substring(i, endIdx + 3);
              currentType = 'string';
              i = endIdx + 2;
            } else {
              currentToken = line.substring(i);
              currentType = 'string';
              break;
            }
          } else {
            flushToken();
            inString = true;
            stringChar = char;
            currentToken = char;
            currentType = 'string';
          }
        } else if (inString && char === stringChar && line[i - 1] !== '\\') {
          currentToken += char;
          flushToken();
          inString = false;
        } else if (inString) {
          currentToken += char;
        } else if (!inComment) {
          // Numbers
          if (/\d/.test(char) && (currentType === 'number' || currentType === 'text')) {
            if (currentType === 'text') flushToken();
            currentToken += char;
            currentType = 'number';
          }
          // Identifiers
          else if (/[a-zA-Z_]/.test(char)) {
            if (currentType !== 'text' && currentType !== 'function' && currentType !== 'builtin' && currentType !== 'keyword') {
              flushToken();
            }
            currentToken += char;
          }
          // Operators
          else if ('=+-*/%<>!&|^~'.includes(char)) {
            flushToken();
            currentToken = char;
            currentType = 'operator';
          }
          // Punctuation
          else if ('(),.:;[]{}'.includes(char)) {
            flushToken();
            result += Utils.escapeHtml(char);
          }
          // Whitespace
          else if (/\s/.test(char)) {
            flushToken();
            result += ' ';
          }
          else {
            flushToken();
            result += Utils.escapeHtml(char);
          }
        } else {
          currentToken += char;
        }
        i++;
      }

      // Handle last token
      if (inComment) {
        flushToken();
      } else if (currentToken) {
        // Determine type of final identifier token
        if (keywords.has(currentToken)) {
          currentType = 'keyword';
        } else if (builtins.has(currentToken)) {
          currentType = 'builtin';
        }
        flushToken();
      }

      return result;
    });
  };

  const highlight = (code) => {
    const highlighted = tokenize(code);
    const lineNumbers = highlighted.map((_, i) => i + 1).join('\n');
    return { lineNumbers, highlighted: highlighted.join('\n') };
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

    const categories = ['true_false', 'mcq', 'short_answer', 'code'];

    categories.forEach(cat => {
      const questions = state.questions[cat];
      const progress = AppState.getProgress(cat);
      const answered = Object.keys(progress).length;
      totalAnswered += answered;
      totalQuestions += questions.length;

      // Count correct
      Object.values(progress).forEach(p => {
        if (p.correct) totalCorrect++;
      });

      // Update dashboard rings
      const ringId = cat === 'true_false' ? 'tf' : cat === 'mcq' ? 'mcq' : cat === 'short_answer' ? 'sa' : 'code';
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
        <p class="question-text">${Utils.escapeHtml(questionText)}</p>
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
            <div class="explanation-text">${Utils.escapeHtml(q.explanation || '')}</div>
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
        <p class="question-text">${Utils.escapeHtml(questionText)}</p>
        <div class="mcq-options">
          ${optionsHTML}
        </div>
        <div class="feedback-container"></div>
        <div class="explanation-container" style="display:none">
          <div class="explanation">
            <div class="explanation-label">${isArabic ? 'الشرح' : 'Explanation'}</div>
            <div class="explanation-text">${Utils.escapeHtml(q.explanation || '')}</div>
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
        <p class="question-text">${Utils.escapeHtml(questionText)}</p>
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
            <div class="model-answer-text">${Utils.escapeHtml(q.answer)}</div>
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
  };

  const shuffle = () => {
    const container = document.getElementById('saQuestions');
    const cards = Array.from(container.children);
    Utils.shuffle(cards).forEach(card => container.appendChild(card));
  };

  return { render, shuffle };
})();

// ========================================
// 8. CODE MODULE
// ========================================
const CodeModule = (() => {
  const render = (questions) => {
    const container = document.getElementById('codeQuestions');
    container.innerHTML = '';

    questions.forEach((q, index) => {
      const state = AppState.get();
      const isArabic = state.preferences.language === 'ar';
      const { lineNumbers, highlighted } = SyntaxHighlighter.highlight(q.code);

      const card = document.createElement('div');
      card.className = 'code-card';
      card.id = `code-${q.id}`;
      card.innerHTML = `
        <div class="code-task">
          <span class="code-task-label">${isArabic ? 'المهمة' : 'Task'} ${index + 1}</span>
          <p class="code-task-text">${Utils.escapeHtml(q.task)}</p>
        </div>
        <div class="code-editor-container">
          <div class="code-header">
            <span class="code-lang">Python</span>
            <div class="code-actions">
              <button class="code-action-btn reset-code-btn" title="Reset to original">
                ${isArabic ? 'إعادة تعيين' : 'Reset'}
              </button>
            </div>
          </div>
          <div class="code-editor-wrapper">
            <div class="code-line-numbers">${lineNumbers}</div>
            <textarea class="code-editor" spellcheck="false" data-original="${Utils.escapeHtml(q.code)}">${Utils.escapeHtml(q.code)}</textarea>
          </div>
        </div>
        <div class="code-output-container">
          <div class="code-output-header">
            <span class="code-output-label">${isArabic ? 'المخرجات' : 'Output'}</span>
            <div class="code-actions">
              <button class="code-action-btn run-code-btn">
                ▶ ${isArabic ? 'تشغيل' : 'Run'}
              </button>
            </div>
          </div>
          <div class="code-output">${isArabic ? 'اضغط على تشغيل لرؤية المخرجات' : 'Press Run to see output'}</div>
        </div>
      `;

      container.appendChild(card);

      const editor = card.querySelector('.code-editor');
      const lineNumbersEl = card.querySelector('.code-line-numbers');
      const runBtn = card.querySelector('.run-code-btn');
      const resetBtn = card.querySelector('.reset-code-btn');
      const outputEl = card.querySelector('.code-output');

      // Update line numbers on input
      const updateLineNumbers = () => {
        const lineCount = editor.value.split('\n').length;
        lineNumbersEl.textContent = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
      };

      editor.addEventListener('input', updateLineNumbers);
      editor.addEventListener('scroll', () => {
        lineNumbersEl.scrollTop = editor.scrollTop;
      });

      // Tab support
      editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = editor.selectionStart;
          const end = editor.selectionEnd;
          editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
          editor.selectionStart = editor.selectionEnd = start + 4;
        }
      });

      // Run code (JavaScript only for safety, with note for Python)
      runBtn.addEventListener('click', () => {
        const code = editor.value;
        outputEl.classList.remove('error');
        
        // Check if it's Python code (which we can't run in browser)
        const hasPythonImports = /import pandas|import matplotlib|import seaborn|import numpy/.test(code);
        
        if (hasPythonImports) {
          outputEl.textContent = `Note: This is Python code and cannot be executed in the browser.\n\nOriginal code:\n\n${code}`;
          return;
        }

        // Try to run as JavaScript
        try {
          const originalLog = console.log;
          const logs = [];
          console.log = (...args) => {
            logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
          };

          // Safe eval with limited scope
          const result = eval(code);
          if (result !== undefined) {
            logs.push(String(result));
          }

          console.log = originalLog;
          outputEl.textContent = logs.length > 0 ? logs.join('\n') : '(no output)';
        } catch (err) {
          outputEl.classList.add('error');
          outputEl.textContent = `Error: ${err.message}`;
        }
      });

      // Reset code
      resetBtn.addEventListener('click', () => {
        editor.value = editor.dataset.original;
        updateLineNumbers();
        outputEl.textContent = isArabic ? 'اضغط على تشغيل لرؤية المخرجات' : 'Press Run to see output';
        outputEl.classList.remove('error');
      });

      // Mark as viewed
      if (!AppState.getProgress('code')[q.id]) {
        AppState.setProgress('code', q.id, { viewed: true, correct: true });
        ProgressManager.updateProgress();
      }
    });
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
      code: 'codeSection'
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

    // Update counts
    document.getElementById('tfCount').textContent = state.questions.true_false.length;
    document.getElementById('mcqCount').textContent = state.questions.mcq.length;
    document.getElementById('saCount').textContent = state.questions.short_answer.length;
    document.getElementById('codeCount').textContent = state.questions.code.length;

    // Apply saved preferences
    UIManager.applyTheme(state.preferences.theme);
    UIManager.applyLanguage(state.preferences.language);

    // Render initial category
    NavigationManager.renderCategory(state.currentCategory);
    ProgressManager.updateProgress();

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
  };

  return { init };
})();

// ========================================
// START APP
// ========================================
document.addEventListener('DOMContentLoaded', App.init);
