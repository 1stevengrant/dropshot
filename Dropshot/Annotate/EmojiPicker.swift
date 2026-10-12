import AppKit
import SwiftUI

struct EmojiPicker: View {
    @Binding var selection: String
    @State private var isPresented = false

    private let stamps = ["✅", "❌", "⚠️", "👉", "👍", "👎", "❤️", "🔥", "⭐️", "🎉", "👀", "🤔", "❓", "❗️", "💡", "🐛", "🚀", "💯", "👏", "🙏", "😊", "😂", "😍", "😎", "😭", "😅", "🤯", "🙌", "💪", "🎯", "🔍", "📌", "🔒", "🔑", "🛠️", "⏰", "➡️", "⬅️", "⬆️", "⬇️"]

    var body: some View {
        Button(selection) { isPresented.toggle() }
            .help("Choose emoji stamp")
            .popover(isPresented: $isPresented) {
                VStack {
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(32)), count: 8)) {
                        ForEach(stamps, id: \.self) { stamp in
                            Button(stamp) {
                                selection = stamp
                                isPresented = false
                            }
                            .font(.system(size: 24))
                            .buttonStyle(.plain)
                            .accessibilityLabel("Stamp \(stamp)")
                        }
                    }
                    TextField("Custom emoji", text: $selection)
                        .onSubmit { isPresented = false }
                    Button("More…") { NSApp.orderFrontCharacterPalette(nil) }
                }
                .padding()
            }
    }
}
