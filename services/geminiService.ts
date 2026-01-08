
import { GoogleGenAI, Type } from "@google/genai";
import { User } from "../types";

/**
 * Service pour interagir avec l'API Gemini.
 * Utilise exclusivement process.env.API_KEY comme requis.
 */

export const getIcebreakers = async (user1: User, user2: User): Promise<string[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Génère 3 questions d'icebreaker professionnelles pour une rencontre de networking entre ces deux profils :
      
      Pair 1 : ${user1.name}, ${user1.role} (${user1.categories.join(', ')}) chez ${user1.company}. Bio : ${user1.bio}
      Pair 2 : ${user2.name}, ${user2.role} (${user2.categories.join(', ')}) chez ${user2.company}. Bio : ${user2.bio}
      
      Les questions doivent être pertinentes, favoriser la synergie et être en français.`,
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

    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA");
    const data = JSON.parse(text);
    return data.questions;
  } catch (error) {
    console.error("Erreur lors de la récupération des icebreakers:", error);
    return [
      "Quels sont vos plus grands défis stratégiques actuels ?",
      "Comment imaginez-vous l'évolution de votre métier d'ici 2 ans ?",
      "Quelle serait la collaboration idéale entre vos deux structures ?"
    ];
  }
};

export const getDuoSummary = async (user1: User, user2: User): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyse pourquoi ces deux pairs forment un excellent 'Duo' basé sur leurs profils :
      
      P1 : ${user1.name} (${user1.categories.join(', ')})
      P2 : ${user2.name} (${user2.categories.join(', ')})
      
      Fournis un résumé percutant de 2 phrases en français expliquant leur synergie potentielle.`,
    });

    return response.text?.trim() || "Une synergie prometteuse basée sur des expertises complémentaires.";
  } catch (error) {
    console.error("Erreur lors de la récupération du résumé duo:", error);
    return "Une synergie stratégique identifiée entre ces deux profils de haut niveau.";
  }
};
