import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Board } from '../../shared/types';
import { useToast } from '../components/Toast/useToast';
import { api } from '../lib/api';

const byName = (a: Board, b: Board) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * Creates a board and shows it in the sidebar straight away, before the server answers. Only the board list is
 * refetched afterwards; refetching the whole library made a new board feel slow.
 */
export function useCreateBoard(onCreated: (board: Board) => void) {
    const queryClient = useQueryClient();
    const toast = useToast();

    return useMutation({
        mutationFn: (name: string) => api.createBoard(name),
        onMutate: async (name) => {
            await queryClient.cancelQueries({ queryKey: ['boards'] });
            const previous = queryClient.getQueryData<Board[]>(['boards']);

            queryClient.setQueryData<Board[]>(['boards'], (boards = []) =>
                boards.some((board) => board.name.toLowerCase() === name.toLowerCase()) ? boards : [...boards, { id: -Date.now(), name, count: 0 }].sort(byName),
            );

            return { previous };
        },
        onError: (error, _name, context) => {
            queryClient.setQueryData(['boards'], context?.previous);
            toast(error.message);
        },
        onSuccess: onCreated,
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['boards'] }),
    });
}
