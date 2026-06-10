// async function carregarSaudacao() {
//     const saudacaoUser = document.getElementById('saudacao-user');
//     if (!saudacaoUser) return;

//     try {
//         const { data: { user } } = await supabaseClient.auth.getUser();
//         if (user) {
//             const nome = user.user_metadata?.full_name; 
//             saudacaoUser.textContent = `Olá, ${nome}!`;
//         } else {
//             saudacaoUser.textContent = "Olá, visitante!";
//         }
//     } catch (e) {
//         saudacaoUser.textContent = `Olá, ${nome}!`;
//     }
// }
async function carregarSaudacao() {
    const saudacaoUser = document.getElementById('saudacao-user');
    if (!saudacaoUser) return;

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            const nome = user.user_metadata?.full_name; 
            saudacaoUser.textContent = ``;
        } else {
            saudacaoUser.textContent = "";
        }
    } catch (e) {
        saudacaoUser.textContent = ``;
    }
}