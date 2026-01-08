
import { GoogleGenAI, Type } from "@google/genai";
import { User } from "../types";

// Removed top-level ai instance to initialize inside functions for better control

export const getIcebreakers = async (user1: User, user2: User): Promise<string[]> => {
  try {
    // Initialize GoogleGenAI right before making the call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate 3 professional icebreaker questions for a networking meeting between these two professionals:
      
      Professional 1: ${user1.name}, ${user1.role} in ${user1.categories.join(', ')} at ${user1.company}. Bio: ${user1.bio}
      Professional 2: ${user2.name}, ${user2.role} in ${user2.categories.join(', ')} at ${user2.company}. Bio: ${user2.bio}
      
      Keep them relevant to their specific fields and potential synergy. Language: French.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["questions"]
        }
      }
    });

    // Directly access .text property
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    const data = JSON.parse(text);
    return data.questions;
  } catch (error) {
    console.error("Error fetching icebreakers:", error);
    return [
      "Quels sont vos plus grands défis actuels ?",
      "Comment voyez-vous l'évolution de votre secteur ?",
      "Quelle collaboration idéale imaginez-vous ?"
    ];
  }
};

export const getDuoSummary = async (user1: User, user2: User): Promise<string> => {
    try {
      // Initialize GoogleGenAI right before making the call
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analayze why these two professionals form a great 'Power Duo' based on their profiles:
        
        P1: ${user1.name} (${user1.categories.join(', ')})
        P2: ${user2.name} (${user2.categories.join(', ')})
        
        Provide a 2-sentence punchy summary in French explaining their synergy.`,
      });
  
      // Directly access .text property
      return response.text?.trim() || "Une synergie prometteuse basée sur des expertises complémentaires.";
    } catch (error) {
      console.error("Error fetching duo summary:", error);
      return "Une synergie prometteuse basée sur des expertises complémentaires.";
    }
  };
