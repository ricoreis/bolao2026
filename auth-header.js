import { supabaseClient } from './supabase-config.js';

export async function carregarSaudacao() {
    const saudacaoUser = document.getElementById('saudacao-user');
    if (!saudacaoUser) return;

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            const { data: usuario } = await supabaseClient
                .from('usuarios')
                .select('nome')
                .eq('id', user.id)
                .single();

            const nomeExibicao = usuario?.nome || user.user_metadata?.full_name || 'Participante';
            saudacaoUser.textContent = `Olá, ${nomeExibicao}`;
        }
    } catch (e) {
        console.error("Erro ao carregar saudação:", e);
    }
}