package com.example.sustaintheglobe

import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Forest = Color(0xFF244337)
private val DeepForest = Color(0xFF1B3028)
private val DarkestForest = Color(0xFF16261F)
private val Ivory = Color(0xFFF5F3EA)
private val Cream = Color(0xFFEFECE1)
private val Mist = Color(0xFFD5DFD1)
private val Sage = Color(0xFFA8B5A0)
private val Sand = Color(0xFFE4E2D8)
private val Ink = Color(0xFF1B201B)
private val Moss = Color(0xFF4C574F)
private val Clay = Color(0xFFB67B4B)

private enum class Tab(val label: String, val glyph: String) { FEED("Feed", "⌂"), TASKS("My Tasks", "✓"), LEADERS("Leaders", "♕"), PROFILE("Profile", "◉") }
private enum class TaskStatus { TODO, SUBMITTED, COMPLETED }
private data class EcoTask(val id: String, val title: String, val detail: String, val frequency: String, val points: Int, val status: TaskStatus = TaskStatus.TODO, val photo: Uri? = null, val caption: String = "")
private data class FeedPost(val id: String, val taskId: String, val title: String, val caption: String, val points: Int, val initials: String, val demo: Boolean = true, val liked: Boolean = false)

@Composable
fun EcoEchoApp() {
    val tasks = remember { mutableStateListOf(
        EcoTask("litter", "Clean up litter", "Take a bag and collect litter from a safe public space.", "Daily", 25),
        EcoTask("shop", "Shop sustainably today", "Choose one low-packaging, refillable, or local item.", "Daily", 15),
        EcoTask("grocery", "Plan a low-waste grocery list", "Make a list that uses what you already have first.", "Weekly", 30),
        EcoTask("led", "Upgrade to LED bulbs", "Replace one old bulb with an energy-efficient LED.", "Monthly", 50)
    ) }
    val posts = remember { mutableStateListOf(
        FeedPost("p1", "litter", "Clean up litter", "A small park clean-up makes a shared space feel cared for.", 25, "DE"),
        FeedPost("p2", "shop", "Shop sustainably today", "A reusable bag and a little less packaging for this week's shop.", 15, "AR"),
        FeedPost("p3", "grocery", "Plan a low-waste grocery list", "Planning meals around the pantry helped reduce waste.", 30, "KM")
    ) }
    var tab by remember { mutableStateOf(Tab.FEED) }
    var completingId by remember { mutableStateOf<String?>(null) }
    var memberName by remember { mutableStateOf("EcoEcho Member") }

    MaterialTheme {
        Surface(Modifier.fillMaxSize(), color = Ivory) {
            val activeTask = tasks.firstOrNull { it.id == completingId }
            if (activeTask != null) {
                CompleteTaskScreen(task = activeTask, onBack = { completingId = null }) { photo, caption ->
                    val index = tasks.indexOfFirst { it.id == activeTask.id }
                    tasks[index] = activeTask.copy(status = TaskStatus.SUBMITTED, photo = photo, caption = caption)
                    posts.add(0, FeedPost("local-${activeTask.id}", activeTask.id, activeTask.title, if (caption.isBlank()) "A new local submission was added.") else caption, activeTask.points, "ME", demo = false))
                    completingId = null
                    tab = Tab.TASKS
                }
            } else {
                Scaffold(bottomBar = { BottomBar(tab) { tab = it } }, containerColor = Ivory) { inset ->
                    Box(Modifier.padding(inset)) {
                        when (tab) {
                            Tab.FEED -> FeedScreen(posts, onLike = { id -> val i = posts.indexOfFirst { it.id == id }; posts[i] = posts[i].copy(liked = !posts[i].liked) }, onOpen = { completingId = it })
                            Tab.TASKS -> TasksScreen(tasks, onTask = { completingId = it })
                            Tab.LEADERS -> LeaderboardScreen()
                            Tab.PROFILE -> ProfileScreen(memberName, { memberName = it }, tasks)
                        }
                    }
                }
            }
        }
    }
}

@Composable private fun BottomBar(current: Tab, onTab: (Tab) -> Unit) {
    Surface(shadowElevation = 8.dp, color = Color.White) {
        Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
            Tab.entries.forEach { item ->
                val selected = item == current
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f).clickable { onTab(item) }.semantics { contentDescription = item.label }.padding(vertical = 4.dp)) {
                    Text(item.glyph, fontSize = 19.sp, color = if (selected) Forest else Moss)
                    Text(item.label, fontSize = 11.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal, color = if (selected) Forest else Moss)
                }
            }
        }
    }
}

@Composable private fun Page(title: String, helper: String, content: @Composable ColumnScope.() -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { BrandBar() }
        item { Column { Text(title, color = DarkestForest, fontFamily = FontFamily.Serif, fontSize = 31.sp, fontWeight = FontWeight.SemiBold); Text(helper, color = Moss, fontSize = 14.sp, modifier = Modifier.padding(top = 4.dp)) } }
        item { Column(content = content) }
    }
}

@Composable private fun BrandBar() = Row(verticalAlignment = Alignment.CenterVertically) {
    Box(Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)).background(Forest), contentAlignment = Alignment.Center) { Text("♧", color = Ivory, fontSize = 23.sp) }
    Spacer(Modifier.width(9.dp)); Text("EcoEcho", color = DarkestForest, fontWeight = FontWeight.Bold, fontSize = 18.sp)
}
@Composable private fun Eyebrow(text: String) = Text(text, color = Moss, fontSize = 11.sp, letterSpacing = 1.4.sp, fontWeight = FontWeight.Bold)
@Composable private fun Chip(text: String, selected: Boolean, onClick: () -> Unit) = Surface(modifier = Modifier.clickable(onClick = onClick), shape = RoundedCornerShape(18.dp), color = if (selected) Forest else Cream, border = if (selected) null else androidx.compose.foundation.BorderStroke(1.dp, Sand)) { Text(text, color = if (selected) Ivory else Moss, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 13.dp, vertical = 8.dp)) }

@Composable private fun FeedScreen(posts: List<FeedPost>, onLike: (String) -> Unit, onOpen: (String) -> Unit) {
    var filter by remember { mutableStateOf("Community") }
    Page("Feed", "Small actions. Shared progress.") {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("Nearby", "Community", "All").forEach { Chip(it, filter == it) { filter = it } } }
        Spacer(Modifier.height(18.dp)); Eyebrow("COMMUNITY EXAMPLES")
        Text("Demo activity", color = Moss, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp, bottom = 9.dp))
        posts.forEach { post ->
            FeedCard(post, { onOpen(post.taskId) }, { onLike(post.id) }); Spacer(Modifier.height(11.dp))
        }
    }
}

@Composable private fun FeedCard(post: FeedPost, onOpen: () -> Unit, onLike: () -> Unit) {
    Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen)) {
        Column {
            Box(Modifier.fillMaxWidth().height(112.dp).background(Mist), contentAlignment = Alignment.Center) { Text("♧", fontSize = 42.sp, color = Forest) }
            Column(Modifier.padding(15.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) { Avatar(post.initials); Spacer(Modifier.width(8.dp)); Text(if (post.demo) "Demo community post" else "Your local submission", color = Moss, fontSize = 12.sp); Spacer(Modifier.weight(1f)); Text("+${post.points}", color = Forest, fontWeight = FontWeight.Bold, fontSize = 13.sp) }
                Text(post.title, color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, modifier = Modifier.padding(top = 10.dp))
                Text(post.caption, color = Moss, fontSize = 13.sp, modifier = Modifier.padding(top = 3.dp))
                Text(if (post.liked) "♥ Saved" else "♡ Save", color = if (post.liked) Clay else Forest, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.align(Alignment.End).padding(top = 9.dp).clickable(onClick = onLike))
            }
        }
    }
}

@Composable private fun TasksScreen(tasks: List<EcoTask>, onTask: (String) -> Unit) = Page("My Tasks", "A few thoughtful actions for this week.") {
    listOf("Daily", "Weekly", "Monthly").forEach { frequency ->
        val selected = tasks.filter { it.frequency == frequency }
        Eyebrow("${frequency.uppercase()} TASKS"); Spacer(Modifier.height(8.dp))
        selected.forEach { TaskCard(it) { onTask(it.id) }; Spacer(Modifier.height(10.dp)) }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable private fun TaskCard(task: EcoTask, onClick: () -> Unit) {
    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).clip(RoundedCornerShape(13.dp)).background(if (task.status == TaskStatus.TODO) Cream else Mist), contentAlignment = Alignment.Center) { Text(if (task.status == TaskStatus.TODO) "♧" else "✓", color = Forest, fontSize = 21.sp) }
            Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) { Text(task.title, color = Ink, fontWeight = FontWeight.SemiBold); Text(task.detail, color = Moss, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp)); Text("${task.frequency} · ${task.points} points", color = Forest, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 5.dp)) }
            StatusPill(task.status)
        }
    }
}

@Composable private fun StatusPill(status: TaskStatus) { val text = if (status == TaskStatus.TODO) "To do" else if (status == TaskStatus.SUBMITTED) "Submitted" else "Completed"; Surface(shape = RoundedCornerShape(12.dp), color = if (status == TaskStatus.TODO) Cream else Mist) { Text(text, color = Forest, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 7.dp, vertical = 5.dp)) } }

@Composable private fun CompleteTaskScreen(task: EcoTask, onBack: () -> Unit, onSubmit: (Uri, String) -> Unit) {
    var photo by remember(task.id) { mutableStateOf<Uri?>(task.photo) }; var caption by remember(task.id) { mutableStateOf(task.caption) }; var notice by remember { mutableStateOf("") }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> if (uri != null) { photo = uri; notice = "" } else notice = "No photo was selected. You can try again." }
    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Text("‹  Back", color = Forest, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable(onClick = onBack).padding(vertical = 8.dp))
        Text("Complete task", color = DarkestForest, fontFamily = FontFamily.Serif, fontSize = 30.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 9.dp))
        Text(task.title, color = Forest, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, modifier = Modifier.padding(top = 5.dp))
        Text("Add a photo showing your action. It stays on this device for this session until an upload service is connected.", color = Moss, fontSize = 14.sp, modifier = Modifier.padding(top = 9.dp))
        Spacer(Modifier.height(20.dp))
        if (photo == null) Box(Modifier.fillMaxWidth().height(230.dp).clip(RoundedCornerShape(18.dp)).border(1.dp, Sand, RoundedCornerShape(18.dp)).background(Cream), contentAlignment = Alignment.Center) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("♧", color = Forest, fontSize = 46.sp); Text("Add a photo of your action", color = Moss, modifier = Modifier.padding(top = 6.dp)) } }
        else PhotoPreview(photo!!)
        Button(onClick = { picker.launch(ActivityResultContracts.PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp), colors = ButtonDefaults.buttonColors(containerColor = if (photo == null) Forest else Cream, contentColor = if (photo == null) Ivory else Forest), shape = RoundedCornerShape(22.dp)) { Text(if (photo == null) "Add photo" else "Change photo") }
        if (photo != null) Text("Remove photo", color = Moss, fontSize = 13.sp, modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 9.dp).clickable { photo = null })
        OutlinedTextField(value = caption, onValueChange = { caption = it }, modifier = Modifier.fillMaxWidth().padding(top = 18.dp), label = { Text("Caption (optional)") }, minLines = 2, shape = RoundedCornerShape(16.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Forest, unfocusedBorderColor = Sand, focusedLabelColor = Forest))
        if (notice.isNotBlank()) Text(notice, color = Clay, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
        Spacer(Modifier.weight(1f))
        Button(onClick = { if (photo == null) notice = "Please add a photo before submitting." else onSubmit(photo!!, caption) }, modifier = Modifier.fillMaxWidth().height(52.dp), enabled = photo != null, colors = ButtonDefaults.buttonColors(containerColor = Forest, disabledContainerColor = Sage, contentColor = Ivory), shape = RoundedCornerShape(26.dp)) { Text("Submit task", fontWeight = FontWeight.Bold) }
    }
}

@Composable private fun PhotoPreview(uri: Uri) { val context = LocalContext.current; val bitmap = remember(uri) { runCatching { if (Build.VERSION.SDK_INT >= 28) android.graphics.ImageDecoder.decodeBitmap(android.graphics.ImageDecoder.createSource(context.contentResolver, uri)) else context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) } }.getOrNull() }; if (bitmap == null) Box(Modifier.fillMaxWidth().height(230.dp).background(Cream), contentAlignment = Alignment.Center) { Text("We couldn't preview this photo.", color = Moss) } else Image(bitmap.asImageBitmap(), "Selected task photo", Modifier.fillMaxWidth().height(230.dp).clip(RoundedCornerShape(18.dp)), contentScale = ContentScale.Crop) }

@Composable private fun LeaderboardScreen() { var weekly by remember { mutableStateOf(true) }; val names = listOf("River Rowan" to 340, "Maya Green" to 290, "Sam Lee" to 245, "Ari Patel" to 180, "Nora Chen" to 155); Page("Leaderboard", "Demo community contributions — not a live ranking.") { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Chip("Weekly", weekly) { weekly = true }; Chip("All-time", !weekly) { weekly = false } }; Spacer(Modifier.height(18.dp)); names.forEachIndexed { index, pair -> Card(shape = RoundedCornerShape(15.dp), colors = CardDefaults.cardColors(containerColor = if (index < 3) Cream else Color.White), modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) { Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) { Text("${index + 1}", color = Forest, fontWeight = FontWeight.Bold, modifier = Modifier.width(25.dp)); Avatar(pair.first.take(2).uppercase()); Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text(pair.first, color = Ink, fontWeight = FontWeight.SemiBold); Text("${index + 2} tasks completed", color = Moss, fontSize = 12.sp) }; Text("${if (weekly) pair.second / 2 else pair.second} pts", color = Forest, fontWeight = FontWeight.Bold) } } } }

@Composable private fun ProfileScreen(name: String, changeName: (String) -> Unit, tasks: List<EcoTask>) { var editing by remember { mutableStateOf(false) }; var draft by remember(name) { mutableStateOf(name) }; val submitted = tasks.filter { it.status != TaskStatus.TODO }; Page("Profile", "Your local EcoEcho contribution summary.") { Row(verticalAlignment = Alignment.CenterVertically) { Avatar(name.take(2).uppercase(), 62); Spacer(Modifier.width(13.dp)); Column(Modifier.weight(1f)) { Text(name, color = DarkestForest, fontFamily = FontFamily.Serif, fontSize = 23.sp, fontWeight = FontWeight.SemiBold); Text("Progress is stored for this app session.", color = Moss, fontSize = 12.sp) }; Text("Edit", color = Forest, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable { editing = !editing }) }; if (editing) { OutlinedTextField(draft, { draft = it }, label = { Text("Display name") }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp)); Button(onClick = { changeName(draft.ifBlank { "EcoEcho Member" }); editing = false }, colors = ButtonDefaults.buttonColors(containerColor = Forest), modifier = Modifier.padding(top = 8.dp)) { Text("Save name") } }; Spacer(Modifier.height(16.dp)); Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) { Metric("${submitted.sumOf { it.points }}", "local points", Modifier.weight(1f)); Metric("${submitted.size}", "submitted", Modifier.weight(1f)); Metric("${submitted.size}", "contributions", Modifier.weight(1f)) }; Spacer(Modifier.height(21.dp)); Eyebrow("MY ACTIVITY"); Text("Recent submissions", color = DarkestForest, fontFamily = FontFamily.Serif, fontSize = 23.sp, modifier = Modifier.padding(top = 7.dp, bottom = 9.dp)); if (submitted.isEmpty()) Text("No submissions yet. Pick a task to begin.", color = Moss) else submitted.forEach { TaskCard(it) {} } }

@Composable private fun Metric(value: String, label: String, modifier: Modifier = Modifier) = Card(modifier, shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = Cream)) { Column(Modifier.padding(12.dp)) { Text(value, color = Forest, fontWeight = FontWeight.Bold, fontSize = 20.sp); Text(label, color = Moss, fontSize = 11.sp) } }
@Composable private fun Avatar(initials: String, size: Int = 30) = Box(Modifier.size(size.dp).clip(CircleShape).background(Mist), contentAlignment = Alignment.Center) { Text(initials, color = Forest, fontWeight = FontWeight.Bold, fontSize = (size / 3).sp) }
