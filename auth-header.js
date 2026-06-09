async function carregarSaudacao() {
    const saudacaoUser = document.getElementById('saudacao-user');
    if (!saudacaoUser) return;

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            // Se você tiver o nome gravado no user_metadata ou no banco:
            const nome = user.user_metadata?.full_name || "Rico"; 
            saudacaoUser.textContent = `Olá, ${nome}!`;
        } else {
            saudacaoUser.textContent = "Olá, visitante!";
        }
    } catch (e) {
        saudacaoUser.textContent = "Olá, Rico!";
    }
}