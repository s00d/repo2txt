import React from "react";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
	if (!isOpen) return null;

	return (
		<div 
			className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]"
			onClick={onClose}
		>
			<div 
				className="bg-white rounded-lg shadow-lg max-w-lg w-[90%] max-h-[80vh] overflow-auto"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between p-5 border-b border-gray-200">
					<h2 className="text-lg font-semibold m-0">{title}</h2>
					<button 
						className="bg-transparent border-none text-2xl cursor-pointer text-gray-600 p-0 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
						onClick={onClose}
					>
						×
					</button>
				</div>
				<div className="p-5">{children}</div>
			</div>
		</div>
	);
}

