export default function ClaudeRecipe(props) {
    return (
        <section>
            <h2>Chef Claude Recommends:</h2>
          <article className="suggested-recipe-container" aria-live="polite">{props.recipe}</article>
        </section>
    )
}
