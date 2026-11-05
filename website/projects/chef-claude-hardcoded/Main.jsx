import React from "react"
import IngredientsList from "./components/IngredientsList"
import ClaudeRecipe from "./components/ClaudeRecipe"

export default function Main() {
    const [ingredients, setIngredients] = React.useState([])
    const [recipe, setRecipe] = React.useState("")
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState("")

    function addIngredient(formData) {
        const newIngredient = formData.get("ingredient")
        setIngredients(prevIngredients => [...prevIngredients, newIngredient])
    }

    async function getRecipe() {
        setLoading(true)
        setError("")
        setRecipe("")

        try {
            const response = await fetch("/api/portfolio/chef-claude/recipe", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ ingredients })
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error)
            setRecipe(data.recipe)
        } catch (err) {
            setError(err.message || "Could not create a recipe.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <main>
            <p className="project-note"><strong>AI edition:</strong> Enter ingredients and Chef Claude will request a recipe from Hugging Face.</p>
            <form action={addIngredient} className="add-ingredient-form">
                <input
                    type="text"
                    placeholder="e.g. oregano"
                    aria-label="Add ingredient"
                    name="ingredient"
                    required
                />
                <button>Add ingredient</button>
            </form>

            {ingredients.length > 0 &&
                <IngredientsList
                    ingredients={ingredients}
                    getRecipe={getRecipe}
                    loading={loading}
                />
            }

            {error && <p className="error-message" role="alert">{error}</p>}
            {recipe && <ClaudeRecipe recipe={recipe} />}
        </main>
    )
}
