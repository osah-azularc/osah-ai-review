import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

export async function reviewWithClaude(prompt) {

    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        temperature: 0,

        messages: [
            {
                role: "user",
                content: prompt
            }
        ]
    });

    return response.content[0].text;
}