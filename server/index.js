const express = require("express");
const cors = require("cors");

const app = express();

// Simple in-memory rate limiting storage (in production, use Redis or database)
const rateLimitStore = {
  ipLimits: new Map(), // IP-based limits
  contactLimits: new Map(), // Contact-based limits
  globalLimits: new Map(), // Global request tracking
  suspiciousIPs: new Set(), // Suspicious IP tracking
  cleanupInterval: null
};

// Clean up old entries every hour
rateLimitStore.cleanupInterval = setInterval(() => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  // Clean IP limits
  for (const [ip, data] of rateLimitStore.ipLimits) {
    if (now - data.firstRequest > oneDay) {
      rateLimitStore.ipLimits.delete(ip);
    }
  }
  
  // Clean contact limits
  for (const [contact, data] of rateLimitStore.contactLimits) {
    if (now - data.firstRequest > oneDay) {
      rateLimitStore.contactLimits.delete(contact);
    }
  }
  
  // Clean global limits
  for (const [date, data] of rateLimitStore.globalLimits) {
    if (now - data.timestamp > oneDay) {
      rateLimitStore.globalLimits.delete(date);
    }
  }
  
  // Clean suspicious IPs after 7 days
  for (const [ip, data] of rateLimitStore.suspiciousIPs) {
    if (now - data > 7 * oneDay) {
      rateLimitStore.suspiciousIPs.delete(ip);
    }
  }
}, 60 * 60 * 1000); // Run every hour

// Enhanced rate limiting middleware with anti-spam
function checkRateLimit(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
  const { email, phone } = req.body;
  
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const maxRequests = 3; // Single limit: 3 requests per day
  const maxGlobalDaily = 100; // Global limit per day
  
  // Check if IP is suspicious
  if (rateLimitStore.suspiciousIPs.has(clientIp)) {
    return res.status(429).json({ 
      error: "Access denied",
      message: "Too many requests. Please try again later.",
      limitType: "suspicious"
    });
  }
  
  // Global daily limit check
  const today = new Date().toDateString();
  const globalData = rateLimitStore.globalLimits.get(today);
  
  if (globalData && globalData.count >= maxGlobalDaily) {
    return res.status(429).json({ 
      error: "Service limit reached",
      message: "Daily service limit reached. Please try again tomorrow.",
      limitType: "global"
    });
  }
  
  // Update global counter
  if (globalData) {
    globalData.count++;
  } else {
    rateLimitStore.globalLimits.set(today, { count: 1, timestamp: now });
  }
  
  // MERGED LIMIT: Check both IP AND contact for single 3-check limit
  let ipData = rateLimitStore.ipLimits.get(clientIp);
  let contactData = null;
  let contactKey = null;
  
  // Get contact data if available
  if (email || phone) {
    contactKey = email ? email.toLowerCase() : phone;
    contactData = rateLimitStore.contactLimits.get(contactKey);
  }
  
  // Check if either IP or contact has reached the limit
  const ipCount = ipData ? (now - ipData.firstRequest < oneDay ? ipData.count : 0) : 0;
  const contactCount = contactData ? (now - contactData.firstRequest < oneDay ? contactData.count : 0) : 0;
  
  // If either IP or contact has reached the limit, block the request
  if (ipCount >= maxRequests || contactCount >= maxRequests) {
    const resetTime = Math.ceil((ipData?.firstRequest || contactData?.firstRequest || now) + oneDay - now) / (60 * 60 * 1000);
    return res.status(429).json({ 
      error: "Rate limit exceeded",
      message: `You can only check ATS ${maxRequests} times per day`,
      resetInHours: Math.ceil(resetTime),
      limitType: "merged"
    });
  }
  
  // Check for rapid requests (potential spam)
  if (ipData) {
    const timeSinceLast = now - ipData.lastRequest;
    if (timeSinceLast < 5000) { // Less than 5 seconds between requests
      ipData.suspiciousCount = (ipData.suspiciousCount || 0) + 1;
      if (ipData.suspiciousCount > 3) {
        rateLimitStore.suspiciousIPs.add(clientIp);
        return res.status(429).json({ 
          error: "Suspicious activity detected",
          message: "Too many rapid requests. Please wait before trying again.",
          limitType: "suspicious"
        });
      }
    }
  }
  
  // Update IP tracking
  if (ipData && now - ipData.firstRequest < oneDay) {
    ipData.count++;
    ipData.lastRequest = now;
  } else {
    rateLimitStore.ipLimits.set(clientIp, { count: 1, firstRequest: now, lastRequest: now });
  }
  
  // Update contact tracking (if available)
  if (contactKey) {
    if (contactData && now - contactData.firstRequest < oneDay) {
      contactData.count++;
      contactData.lastRequest = now;
    } else {
      rateLimitStore.contactLimits.set(contactKey, { count: 1, firstRequest: now, lastRequest: now });
    }
  }
  
  // Add rate limit info to response headers
  const currentIpData = rateLimitStore.ipLimits.get(clientIp);
  const actualCount = Math.max(ipCount, contactCount) + 1; // Current request count
  res.setHeader('X-RateLimit-Limit', maxRequests);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - actualCount));
  res.setHeader('X-RateLimit-Reset', new Date((currentIpData?.firstRequest || now) + oneDay).toISOString());
  
  next();
}

// CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-netlify-domain.netlify.app', 'http://localhost:3000']
    : true,
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(checkRateLimit);

// Extract skills from text using keyword matching
function extractSkills(text) {
  const skillKeywords = [
    // Programming Languages
    'python', 'java', 'javascript', 'typescript', 'c', 'c++', 'c#', 'ruby', 'php',
    'go', 'rust', 'swift', 'kotlin', 'scala', 'perl', 'r', 'matlab', 'dart',
    
    // Frontend Technologies
    'react', 'angular', 'vue', 'svelte', 'next', 'nuxt', 'gatsby', 'redux',
    'html', 'html5', 'css', 'css3', 'sass', 'scss', 'less', 'bootstrap',
    'tailwind', 'material', 'ui', 'ux', 'figma', 'sketch', 'webpack', 'vite',
    
    // Backend Technologies
    'node', 'nodejs', 'express', 'koa', 'nestjs', 'django', 'flask', 'fastapi',
    'spring', 'springboot', 'hibernate', 'laravel', 'rails', 'symfony',
    
    // Databases
    'sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'oracle',
    'sqlite', 'cassandra', 'dynamodb', 'elasticsearch', 'firebase', 'supabase',
    
    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'cloud', 'docker', 'kubernetes', 'k8s', 'jenkins',
    'gitlab', 'circleci', 'travis', 'terraform', 'ansible', 'puppet', 'chef',
    'vagrant', 'nginx', 'apache', 'microservices', 'serverless', 'lambda',
    
    // Version Control
    'git', 'github', 'gitlab', 'bitbucket', 'svn', 'mercurial', 'ci', 'cd',
    'cicd', 'devops', 'version', 'control',
    
    // APIs & Protocols
    'api', 'apis', 'rest', 'restful', 'soap', 'graphql', 'grpc', 'websocket',
    'http', 'https', 'tcp', 'udp', 'json', 'xml', 'yaml', 'csv',
    
    // Testing & Quality
    'testing', 'test', 'unit', 'integration', 'e2e', 'selenium', 'jest',
    'mocha', 'jasmine', 'karma', 'cypress', 'playwright', 'junit', 'pytest',
    'quality', 'assurance', 'qa', 'tdd', 'bdd',
    
    // Data Science & AI
    'machine', 'learning', 'ml', 'ai', 'artificial', 'intelligence', 'data',
    'science', 'analytics', 'analysis', 'tensorflow', 'pytorch', 'keras',
    'scikit', 'pandas', 'numpy', 'spark', 'hadoop', 'tableau', 'powerbi',
    'statistics', 'mining', 'visualization', 'nlp', 'cv', 'computervision',
    
    // Mobile Development
    'ios', 'android', 'reactnative', 'flutter', 'swift', 'kotlin', 'xamarin',
    'cordova', 'ionic', 'mobile', 'app', 'development',
    
    // Cybersecurity
    'security', 'cybersecurity', 'encryption', 'authentication', 'authorization',
    'oauth', 'jwt', 'ssl', 'tls', 'firewall', 'vpn', 'penetration', 'audit',
    
    // Project Management & Methodologies
    'project', 'management', 'agile', 'scrum', 'kanban', 'waterfall', 'lean',
    'six', 'sigma', 'pmp', 'prince2', 'jira', 'confluence', 'trello', 'asana',
    'milestone', 'timeline', 'planning', 'scheduling', 'risk', 'stakeholder',
    
    // Leadership & Soft Skills
    'leadership', 'team', 'leadership', 'management', 'communication', 'speaking',
    'presentation', 'public', 'speaking', 'client', 'relations', 'customer',
    'service', 'negotiation', 'mentoring', 'coaching', 'delegation', 'motivation',
    'collaboration', 'teamwork', 'interpersonal', 'networking', 'emotional',
    'intelligence', 'adaptability', 'flexibility', 'creativity', 'innovation',
    
    // Problem Solving & Analytics
    'problem', 'solving', 'analytical', 'thinking', 'critical', 'thinking',
    'research', 'troubleshooting', 'debugging', 'optimization', 'performance',
    'efficiency', 'automation', 'scripting', 'algorithms', 'structures',
    
    // Documentation & Writing
    'documentation', 'writing', 'technical', 'writing', 'blogging', 'content',
    'manual', 'guide', 'readme', 'wiki', 'knowledge', 'base', 'specification',
    
    // Business & Strategy
    'business', 'strategy', 'marketing', 'sales', 'revenue', 'profit', 'budget',
    'cost', 'roi', 'kpi', 'metrics', 'analytics', 'reporting', 'dashboard',
    
    // General IT Skills
    'linux', 'ubuntu', 'centos', 'debian', 'windows', 'mac', 'macos', 'unix',
    'shell', 'bash', 'powershell', 'cmd', 'terminal', 'networking', 'tcpip',
    'dns', 'dhcp', 'vpn', 'proxy', 'load', 'balancer', 'cdn',
    
    // Web Technologies
    'web', 'website', 'frontend', 'backend', 'fullstack', 'responsive',
    'progressive', 'pwa', 'spa', 'ssr', 'ssg', 'jamstack', 'headless'
  ];

  const textLower = text.toLowerCase();
  const foundSkills = [];
  
  // Split by commas and check each part
  const parts = textLower.split(',');
  parts.forEach(part => {
    const cleanPart = part.trim();
    if (skillKeywords.includes(cleanPart)) {
      foundSkills.push(cleanPart);
    }
  });
  
  // Also check individual words
  const words = textLower.split(/\s+/);
  words.forEach(word => {
    const cleanWord = word.replace(/[^\w]/g, '');
    if (skillKeywords.includes(cleanWord) && !foundSkills.includes(cleanWord)) {
      foundSkills.push(cleanWord);
    }
  });
  
  return [...new Set(foundSkills)];
}

// Generate ATS analysis using Gemini API
async function analyzeATS(resume, jd) {
  const apiKey = process.env.GEMINI_API_KEY || "AIzaSyAfZXNAm3stDQeXNbZlKe9PcpGY6slvzXU";
  
  const resumeSkills = extractSkills(resume);
  const jdSkills = extractSkills(jd);
  
  const matched = resumeSkills.filter(skill => jdSkills.includes(skill));
  const missing = jdSkills.filter(skill => !resumeSkills.includes(skill));
  
  const keywordScore = jdSkills.length > 0 ? (matched.length / jdSkills.length) * 100 : 0;
  
  // Use Gemini for semantic analysis and suggestions
  const geminiPrompt = `
Analyze this resume against the job description and provide ATS optimization suggestions:

RESUME:
${resume}

JOB DESCRIPTION:
${jd}

Current Analysis:
- Matched Skills: ${matched.join(', ')}
- Missing Skills: ${missing.join(', ')}
- Keyword Match Rate: ${keywordScore.toFixed(1)}%

Provide:
1. Overall ATS compatibility score (0-100)
2. Detailed improvement suggestions with categories:
   - Technical Skills
   - Soft Skills  
   - Resume Structure
   - Content Length
3. Actionable steps for each suggestion

Respond in JSON format:
{
  "score": number,
  "matched_skills": [array],
  "missing_skills": [array],
  "improvement_suggestions": [
    {
      "category": "string",
      "priority": "High|Medium|Low",
      "suggestion": "string",
      "actionable_steps": [array]
    }
  ],
  "analysis": {
    "keyword_match_rate": number,
    "semantic_similarity": number,
    "total_resume_skills": number,
    "total_jd_skills": number,
    "improvement_potential": number
  }
}
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: geminiPrompt
          }]
        }]
      })
    });

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const geminiResponse = data.candidates[0].content.parts[0].text;
      const jsonMatch = geminiResponse.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const geminiAnalysis = JSON.parse(jsonMatch[0]);
        return {
          score: Math.round(geminiAnalysis.score || keywordScore),
          matched_skills: matched.slice(0, 10),
          missing_skills: missing.slice(0, 15),
          improvement_suggestions: geminiAnalysis.improvement_suggestions || [],
          analysis: {
            keyword_match_rate: Math.round(keywordScore),
            semantic_similarity: geminiAnalysis.analysis?.semantic_similarity || Math.round(keywordScore * 0.9),
            total_resume_skills: resumeSkills.length,
            total_jd_skills: jdSkills.length,
            improvement_potential: Math.round(100 - (geminiAnalysis.score || keywordScore))
          }
        };
      }
    }
    
    // Fallback if Gemini fails
    return {
      score: Math.round(keywordScore),
      matched_skills: matched.slice(0, 10),
      missing_skills: missing.slice(0, 15),
      improvement_suggestions: [
        {
          category: "Overall Match",
          priority: keywordScore > 70 ? "Low" : keywordScore > 50 ? "Medium" : "High",
          suggestion: `Your resume has ${keywordScore > 70 ? 'good' : keywordScore > 50 ? 'moderate' : 'low'} compatibility with this job description.`,
          actionable_steps: [
            "Add more relevant keywords from the job description",
            "Highlight specific experiences that match job requirements",
            "Include quantifiable achievements where possible"
          ]
        }
      ],
      analysis: {
        keyword_match_rate: Math.round(keywordScore),
        semantic_similarity: Math.round(keywordScore * 0.9),
        total_resume_skills: resumeSkills.length,
        total_jd_skills: jdSkills.length,
        improvement_potential: Math.round(100 - keywordScore)
      }
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    // Return basic analysis if Gemini fails
    return {
      score: Math.round(keywordScore),
      matched_skills: matched.slice(0, 10),
      missing_skills: missing.slice(0, 15),
      improvement_suggestions: [
        {
          category: "Overall Match",
          priority: keywordScore > 70 ? "Low" : keywordScore > 50 ? "Medium" : "High",
          suggestion: `Your resume has ${keywordScore > 70 ? 'good' : keywordScore > 50 ? 'moderate' : 'low'} compatibility with this job description.`,
          actionable_steps: [
            "Add more relevant keywords from the job description",
            "Highlight specific experiences that match job requirements",
            "Include quantifiable achievements where possible"
          ]
        }
      ],
      analysis: {
        keyword_match_rate: Math.round(keywordScore),
        semantic_similarity: Math.round(keywordScore * 0.9),
        total_resume_skills: resumeSkills.length,
        total_jd_skills: jdSkills.length,
        improvement_potential: Math.round(100 - keywordScore)
      }
    };
  }
}

// Extract contact information from resume
function extractContactInfo(resume) {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
  
  const emails = resume.match(emailRegex) || [];
  const phones = resume.match(phoneRegex) || [];
  
  return {
    email: emails[0] || null,
    phone: phones[0] || null
  };
}

app.post("/ats-check", async (req, res) => {
  try {
    const { resume, jd } = req.body;
    
    if (!resume || !jd) {
      return res.status(400).json({ error: "Resume and job description are required" });
    }

    // Extract contact info for rate limiting
    const contactInfo = extractContactInfo(resume);
    req.body.email = contactInfo.email;
    req.body.phone = contactInfo.phone;

    const result = await analyzeATS(resume, jd);
    
    // Add rate limit info to response
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const ipData = rateLimitStore.ipLimits.get(clientIp);
    
    // Get contact info for merged count (already extracted above)
    let contactData = null;
    if (contactInfo.email || contactInfo.phone) {
      const contactKey = contactInfo.email ? contactInfo.email.toLowerCase() : contactInfo.phone;
      contactData = rateLimitStore.contactLimits.get(contactKey);
    }
    
    // Calculate merged count (highest of IP or contact)
    const ipCount = ipData ? (Date.now() - ipData.firstRequest < 24 * 60 * 60 * 1000 ? ipData.count : 0) : 0;
    const contactCount = contactData ? (Date.now() - contactData.firstRequest < 24 * 60 * 60 * 1000 ? contactData.count : 0) : 0;
    const actualCount = Math.max(ipCount, contactCount);
    
    const rateLimitInfo = {
      remaining: Math.max(0, 3 - actualCount),
      limit: 3,
      resetInHours: ipData ? Math.ceil((ipData.firstRequest + 24 * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000)) : 24
    };
    
    res.json({
      ...result,
      rateLimit: rateLimitInfo
    });
  } catch (error) {
    res.status(500).json({ error: "Error analyzing ATS compatibility" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});