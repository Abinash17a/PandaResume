from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, util
import spacy
import re

app = FastAPI()

# Load models once (important)
model = SentenceTransformer('all-MiniLM-L6-v2')
nlp = spacy.load("en_core_web_sm")

# Request schema
class ATSRequest(BaseModel):
    resume: str
    jd: str

# Extract simple skills (basic version)
def extract_skills(text):
    doc = nlp(text.lower())
    skills = []

    for token in doc:
        if token.pos_ in ["NOUN", "PROPN"]:
            skills.append(token.text)

    return list(set(skills))

# Generate improvement suggestions
def generate_improvement_suggestions(resume, jd, missing_skills, matched_skills, score):
    suggestions = []
    
    # Score-based suggestions
    if score < 50:
        suggestions.append({
            "category": "Overall Match",
            "priority": "High",
            "suggestion": "Your resume has low compatibility with this job description. Consider major revisions.",
            "actionable_steps": [
                "Add more relevant keywords from the job description",
                "Highlight specific experiences that match job requirements",
                "Consider reformatting to better align with job expectations"
            ]
        })
    elif score < 70:
        suggestions.append({
            "category": "Overall Match", 
            "priority": "Medium",
            "suggestion": "Your resume shows moderate compatibility. Some improvements can increase your chances.",
            "actionable_steps": [
                "Incorporate missing key skills and terminology",
                "Strengthen descriptions of relevant experience",
                "Add quantifiable achievements where possible"
            ]
        })
    else:
        suggestions.append({
            "category": "Overall Match",
            "priority": "Low", 
            "suggestion": "Your resume has good compatibility. Minor tweaks can make it even stronger.",
            "actionable_steps": [
                "Fine-tune language to match job description exactly",
                "Add specific metrics and outcomes",
                "Ensure all key requirements are clearly addressed"
            ]
        })
    
    # Missing skills suggestions
    if missing_skills:
        # Categorize missing skills
        technical_skills = [skill for skill in missing_skills if any(tech in skill.lower() for tech in ['python', 'java', 'javascript', 'react', 'node', 'sql', 'aws', 'docker', 'kubernetes', 'git', 'api', 'database'])]
        soft_skills = [skill for skill in missing_skills if skill.lower() in ['communication', 'leadership', 'teamwork', 'problem-solving', 'analytical', 'creative']]
        
        if technical_skills:
            suggestions.append({
                "category": "Technical Skills",
                "priority": "High",
                "suggestion": f"You're missing {len(technical_skills)} key technical skills mentioned in the job description.",
                "missing_items": technical_skills,
                "actionable_steps": [
                    f"Add these technical skills to your skills section: {', '.join(technical_skills[:5])}",
                    "Include projects where you've used these technologies",
                    "Consider online courses or certifications if you lack experience"
                ]
            })
        
        if soft_skills:
            suggestions.append({
                "category": "Soft Skills", 
                "priority": "Medium",
                "suggestion": f"Consider highlighting these soft skills: {', '.join(soft_skills)}",
                "missing_items": soft_skills,
                "actionable_steps": [
                    "Add specific examples demonstrating these skills in your experience section",
                    "Include them in your summary or objective statement",
                    "Use achievement-oriented language that implies these qualities"
                ]
            })
    
    # Resume structure suggestions
    resume_sections = ['experience', 'education', 'skills', 'projects', 'certifications']
    missing_sections = []
    
    for section in resume_sections:
        if section not in resume.lower():
            missing_sections.append(section)
    
    if missing_sections:
        suggestions.append({
            "category": "Resume Structure",
            "priority": "Medium",
            "suggestion": "Consider adding these sections to strengthen your resume:",
            "missing_items": missing_sections,
            "actionable_steps": [
                f"Add a {missing_sections[0]} section if you have relevant experience" if missing_sections else "",
                "Include quantifiable achievements in each section",
                "Ensure section headers are clear and professional"
            ]
        })
    
    # Keyword optimization
    jd_words = len(jd.split())
    resume_words = len(resume.split())
    
    if resume_words < 200:
        suggestions.append({
            "category": "Content Length",
            "priority": "Medium",
            "suggestion": "Your resume might be too brief. Consider adding more detail.",
            "actionable_steps": [
                "Expand on your key achievements and responsibilities",
                "Add specific metrics and outcomes",
                "Include relevant projects and certifications"
            ]
        })
    elif resume_words > 600:
        suggestions.append({
            "category": "Content Length",
            "priority": "Low", 
            "suggestion": "Your resume might be too lengthy. Consider being more concise.",
            "actionable_steps": [
                "Focus on the most relevant experiences for this job",
                "Remove outdated or irrelevant information",
                "Use bullet points to make content more scannable"
            ]
        })
    
    return suggestions

@app.post("/analyze")
def analyze(data: ATSRequest):
    resume = data.resume
    jd = data.jd

    # Extract skills
    resume_skills = extract_skills(resume)
    jd_skills = extract_skills(jd)

    # Keyword matching
    matched = list(set(resume_skills) & set(jd_skills))
    missing = list(set(jd_skills) - set(resume_skills))

    keyword_score = len(matched) / max(len(jd_skills), 1)

    # Semantic similarity
    similarity = util.cos_sim(
        model.encode(resume),
        model.encode(jd)
    ).item()

    # Final score
    final_score = (0.5 * keyword_score + 0.5 * similarity) * 100

    # Generate improvement suggestions
    suggestions = generate_improvement_suggestions(resume, jd, missing, matched, final_score)

    return {
        "score": round(final_score, 2),
        "matched_skills": matched[:10],  # Limit to top 10
        "missing_skills": missing[:15],  # Limit to top 15
        "improvement_suggestions": suggestions,
        "analysis": {
            "keyword_match_rate": round(keyword_score * 100, 2),
            "semantic_similarity": round(similarity * 100, 2),
            "total_resume_skills": len(resume_skills),
            "total_jd_skills": len(jd_skills),
            "improvement_potential": round((100 - final_score), 2)
        }
    }