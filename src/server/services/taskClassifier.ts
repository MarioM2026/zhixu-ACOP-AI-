/**
 * 任务分类器
 * 根据用户输入文本，识别任务类型（代码审查/Bug修复/重构等）
 */
import { TaskType } from '../../shared/types/index';
import { logger } from './logger';

interface ClassificationResult {
  taskType: TaskType;
  confidence: number;      // 置信度 0-1
  matchedKeywords: string[]; // 命中的关键词
  reasoning: string;        // 分类理由
}

/** 任务类型识别规则 */
const TASK_PATTERNS: Array<{
  taskType: TaskType;
  patterns: RegExp[];
  keywords: string[];
  weight: number;  // 命中权重
}> = [
  {
    taskType: 'bug_fix',
    patterns: [
      /\b(bug|fix|修复|报错|出错|错误|exception|error|fail|失败|崩溃|crash)\b/i,
      /\b(not work|不工作|wrong|不对|不对|issue|问题)\b/i,
      /\bfix (me|this|the|my)\b/i,
      /\b修复.*(代码|函数|方法|逻辑)\b/,
    ],
    keywords: ['fix bug', 'fix this', '修复', '报错', 'error', 'exception', 'bug fix', '修复一下', '修一下', '出问题', '不工作了'],
    weight: 3,
  },
  {
    taskType: 'debugging',
    patterns: [
      /\b(debug|调试|trace|追踪|排查)\b/i,
      /\bconsole\.log|print\(|logger\.|logging\b/i,
      /\bbreakpoint|断点|watch\b/i,
      /\b(step|单步|stack trace|调用栈)\b/i,
      /\bwhy is (it|this|the).*(failing|not|error)\b/i,
    ],
    keywords: ['debug', '调试', 'trace', '排查', '断点', '原因是什么', 'why is', 'stack trace'],
    weight: 3,
  },
  {
    taskType: 'code_review',
    patterns: [
      /\b(review|reviewer|审查|审核|check|检查)\b/i,
      /\b(look at|看看|review|review this|review the)\b/i,
      /\bbest practice|最佳实践|最佳做法\b/i,
      /\b(improve|improve this|优化.*代码|代码.*优化)\b/i,
      /\b(security|safety|安全|风险)\b/i,
    ],
    keywords: ['review', 'review this', '审查', '看看这个代码', '检查一下', '帮我看看', '代码审查', 'review code', 'review the'],
    weight: 2,
  },
  {
    taskType: 'refactoring',
    patterns: [
      /\b(refactor|rewrite|restructure)\b/i,
      /重构|重写|简化|clean up|make it better|更好的写法|提取方法/i,
      /\b(simplify|简化.*代码)\b/i,
      /\b(extract|提炼|抽取).*(method|function)\b/i,
      /\b(DRY|SOLID|设计模式)\b/i,
    ],
    keywords: ['refactor', '重构', '重写', 'rewrite', '简化', 'clean up', 'clean code', 'make it better', '更好的写法', '提取方法', '让它更简洁', '更简洁'],
    weight: 3,
  },
  {
    taskType: 'code_completion',
    patterns: [
      /^\s*[a-zA-Z_][\w]*\s*[=:]\s*[^=]/m,  // 单行赋值
      /\b(function|fn|def|class|interface|enum)\s+\w+\s*\(/,
      /\}\s*$/m,                              // 行末闭合
    ],
    keywords: ['complete', '补全', '补齐', 'fill in', 'complete this'],
    weight: 1,
  },
  {
    taskType: 'code_generation',
    patterns: [
      /\b(generate|create|build|implement)\b/i,
      /写一个|帮我写|生成一个|写个|写个函数|写个算法|帮我生成|写一个排序|写一个查找/i,
      /\b(want to|wanna|需要|想要).*(function|class|method|代码)\b/i,
    ],
    keywords: ['generate', 'create', 'build', 'write a function', 'implement', '写一个函数', '帮我写', '生成代码', 'create a', 'add a', '写一个', '帮我写一个'],
    weight: 2,
  },
  {
    taskType: 'explanation',
    patterns: [
      /\b(explain|explain this|解释|说明)\b/i,
      /\b(what does|what is|what are|是什么|干什么|干啥的)\b/i,
      /\b(tell me|告诉我|explain how)\b/i,
      /\b(how does|how to|如何|怎么)\b/i,
      /\b(why|为什么|原因)\b/i,
    ],
    keywords: ['explain', '解释', 'what is', '这是什么', '告诉我', '说明一下', 'explain how', 'how does', 'why'],
    weight: 2,
  },
  {
    taskType: 'documentation',
    patterns: [
      /\b(doc|document|文档|说明文档|readme|注释)\b/i,
      /\b(write|add|add this).*(comment|doc|注释|文档)\b/i,
      /\b(生成|写).*(文档|说明|注释|readme)\b/i,
      /\b(jsdoc|typedoc|swagger|openapi)\b/i,
    ],
    keywords: ['document', '文档', 'doc', 'README', 'add comment', '写注释', '注释一下', '生成文档'],
    weight: 2,
  },
  {
    taskType: 'testing',
    patterns: [
      /\b(test|testing|测试|unit test|单元测试)\b/i,
      /\b(write|add|create).*(test|spec|测试用例)\b/i,
      /\b(jest|vitest|mocha|pytest|junit)\b/i,
      /\b(mock|stub|spy|fixture)\b/i,
      /\b(coverage|覆盖率)\b/i,
    ],
    keywords: ['test', '测试', 'unit test', '写测试', 'add test', 'create test', '测试用例', 'jest', 'vitest'],
    weight: 3,
  },
  {
    taskType: 'optimization',
    patterns: [
      /\b(optimize|optimise|optimization)\b/i,
      /优化|性能|提速|加快|speed up|faster|慢|延迟|performance|latency/i,
      /\b(slow|慢|性能|performance|latency)\b/i,
      /\b(faster|speed up|提速|加快)\b/i,
      /\b(memory|内存|空间复杂度|时间复杂度|O\(n\))\b/i,
    ],
    keywords: ['optimize', '优化', '性能', 'speed up', 'faster', 'slow', '性能优化', '快一点', '延迟', '太慢了', '优化性能'],
    weight: 3,
  },
  {
    taskType: 'security_review',
    patterns: [
      /\b(security|vulnerability|漏洞|安全|threat|威胁|风险)\b/i,
      /\b(sql injection|XSS|CSRF|注入|越权)\b/i,
      /\b(auth|authenticate|授权|权限|permission)\b/i,
      /\b(encrypt|decrypt|加密|解密|cipher)\b/i,
    ],
    keywords: ['security', '安全', 'vulnerability', '漏洞', 'XSS', 'SQL注入', 'threat', '风险'],
    weight: 3,
  },
  {
    taskType: 'architecture',
    patterns: [
      /\b(architecture|architect|架构|系统设计|design pattern)\b/i,
      /\b(microservice|monolith|serverless|架构|设计)\b/i,
      /\b(API|interface|接口设计|contract)\b/i,
      /\b(scalability|扩展性|可用性|reliability)\b/i,
    ],
    keywords: ['architecture', '架构', 'design', '系统设计', 'microservice', 'design pattern'],
    weight: 3,
  },
  {
    taskType: 'migration',
    patterns: [
      /\b(migrate|migration|迁移|port|移植|convert|转换)\b/i,
      /\b(from.*to|从.*到|旧.*新)\b/i,
      /\b(update.*to|升级|upgrade)\b/i,
    ],
    keywords: ['migrate', 'migration', '迁移', 'from to', 'port to', 'convert to', '升级到'],
    weight: 3,
  },
];

/** 代码片段检测（辅助判断） */
const CODE_INDICATORS = [
  'function ', 'const ', 'let ', 'var ', 'class ', 'interface ',
  'import ', 'export ', 'return ', 'async ', 'await ',
  'def ', 'fn ', 'pub ', 'struct ', 'impl ',
  '()', '{}', '[]', '=>', '->',
  'if (', 'for (', 'while (', 'switch (',
  '===', '!==', '&&', '||',
];

class TaskClassifier {
  /**
   * 分类用户输入的任务类型
   * @param input 用户输入文本（可以是多行）
   * @param sessionContext 会话上下文（可选，用于辅助判断）
   */
  classify(input: string, sessionContext?: { sessionId: string; recentTypes?: TaskType[] }): ClassificationResult {
    const normalizedInput = input.trim();
    const lines = normalizedInput.split('\n');
    const shortInput = normalizedInput.slice(0, 200); // 取前200字符用于快速匹配

    const scores: Map<TaskType, { score: number; matched: string[] }> = new Map();

    for (const rule of TASK_PATTERNS) {
      let matchedCount = 0;
      const matchedKeywords: string[] = [];

      // 正则匹配
      for (const pattern of rule.patterns) {
        if (pattern.test(shortInput) || pattern.test(normalizedInput)) {
          matchedCount++;
          matchedKeywords.push(pattern.source.slice(0, 30));
        }
      }

      // 关键词匹配
      for (const keyword of rule.keywords) {
        if (normalizedInput.toLowerCase().includes(keyword.toLowerCase())) {
          matchedCount++;
          matchedKeywords.push(keyword);
        }
      }

      if (matchedCount > 0) {
        const score = matchedCount * rule.weight;
        scores.set(rule.taskType, { score, matched: [...new Set(matchedKeywords)] });
      }
    }

    // 代码片段检测加分
    const codeIndicatorCount = CODE_INDICATORS.filter(ind => normalizedInput.includes(ind)).length;
    if (codeIndicatorCount >= 2) {
      const existing = scores.get('code_generation') || { score: 0, matched: [] };
      scores.set('code_generation', {
        score: existing.score + codeIndicatorCount,
        matched: [...existing.matched, `代码片段检测(+${codeIndicatorCount})`],
      });
    }

    // 计算置信度
    const sorted = Array.from(scores.entries()).sort((a, b) => b[1].score - a[1].score);

    if (sorted.length === 0) {
      return {
        taskType: 'general',
        confidence: 0.3,
        matchedKeywords: [],
        reasoning: '无明显任务特征，默认为通用对话',
      };
    }

    const [topType, topData] = sorted[0];
    const topScore = topData.score;

    // 置信度计算：最高分 vs 第二名差距越大置信度越高
    const secondScore = sorted.length > 1 ? sorted[1][1].score : 0;
    const gap = topScore - secondScore;
    const confidence = Math.min(0.95, 0.5 + gap * 0.15 + (topData.matched.length > 2 ? 0.1 : 0));

    // 上下文辅助：如果最近同类任务较多，适当提高置信度
    let adjustedConfidence = confidence;
    if (sessionContext?.recentTypes?.length) {
      const recentCount = sessionContext.recentTypes.filter(t => t === topType).length;
      if (recentCount >= 2) {
        adjustedConfidence = Math.min(0.95, adjustedConfidence + 0.15);
      }
    }

    const reasonings: Record<TaskType, string> = {
      bug_fix: '检测到错误/修复相关关键词，识别为 Bug 修复任务',
      debugging: '检测到调试/追踪相关关键词，识别为调试诊断任务',
      code_review: '检测到审查/检查相关关键词，识别为代码审查任务',
      refactoring: '检测到重构/优化相关关键词，识别为重构任务',
      code_completion: '检测到代码片段特征，识别为代码补全任务',
      code_generation: '检测到生成/创建相关关键词，识别为代码生成任务',
      explanation: '检测到解释/说明相关关键词，识别为代码解释任务',
      documentation: '检测到文档/注释相关关键词，识别为文档生成任务',
      testing: '检测到测试相关关键词，识别为测试生成任务',
      optimization: '检测到性能/优化相关关键词，识别为性能优化任务',
      security_review: '检测到安全/风险相关关键词，识别为安全审查任务',
      architecture: '检测到架构/设计相关关键词，识别为架构设计任务',
      migration: '检测到迁移/转换相关关键词，识别为代码迁移任务',
      general: '无明显任务特征，默认为通用对话',
    };

    logger.debug(`[TaskClassifier] 输入类型识别: ${topType} (置信度 ${(adjustedConfidence * 100).toFixed(0)}%)`);

    return {
      taskType: topType,
      confidence: Math.round(adjustedConfidence * 100) / 100,
      matchedKeywords: topData.matched,
      reasoning: reasonings[topType],
    };
  }

  /** 获取所有支持的任务类型 */
  getSupportedTaskTypes(): TaskType[] {
    return TASK_PATTERNS.map(r => r.taskType);
  }

  /** 获取任务类型的中文名称 */
  getTaskTypeName(taskType: TaskType): string {
    const names: Record<TaskType, string> = {
      bug_fix: 'Bug 修复',
      debugging: '调试诊断',
      code_review: '代码审查',
      refactoring: '重构优化',
      code_completion: '代码补全',
      code_generation: '代码生成',
      explanation: '代码解释',
      documentation: '文档生成',
      testing: '测试生成',
      optimization: '性能优化',
      security_review: '安全审查',
      architecture: '架构设计',
      migration: '代码迁移',
      general: '通用对话',
    };
    return names[taskType] || taskType;
  }
}

export const taskClassifier = new TaskClassifier();
