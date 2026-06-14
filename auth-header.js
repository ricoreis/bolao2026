import { supabaseClient } from './supabase-config.js';

export async function carregarSaudacao() {
    // Busca pelo seletor de classe (.saudacao-user)
    const elementosSaudacao = document.querySelectorAll('.saudacao-user');
    if (elementosSaudacao.length === 0) return;

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            const { data: usuario } = await supabaseClient
                .from('usuarios')
                .select('nome')
                .eq('id', user.id)
                .single();

            const nomeExibicao = usuario?.nome || user.user_metadata?.full_name || 'Participante';
            
            // Atualiza todos os elementos que possuem essa classe
            elementosSaudacao.forEach(el => {
                el.textContent = `Olá, ${nomeExibicao}`;
            });
        }
    } catch (e) {
        console.error("Erro ao carregar saudação:", e);
    }
}